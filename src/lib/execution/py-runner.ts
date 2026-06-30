import type { ExecutionResult, OutputStream } from '../code-execution';

type WorkerMessage =
  | { type: 'running'; id: number }
  | { type: 'stream'; id: number; stream: 'stdout' | 'stderr'; content: string }
  | { type: 'done'; id: number; success: boolean; error?: string }
  | { type: 'load-error'; id: number; error: string };

/** Cap on captured output — bounds memory and the realtime broadcast payload. */
const MAX_OUTPUT_CHARS = 50_000;

/** Generous budget for the first-run Pyodide download + WASM init. */
const LOAD_TIMEOUT_MS = 60_000;

// Long-lived singleton worker: Pyodide loads once and is reused across runs.
// Dropped (and recreated on next run) only when it can't be salvaged — timeout,
// load failure, or worker error.
let worker: Worker | null = null;
let nextId = 1;

// The singleton interpreter can only run one script at a time, so runs are
// serialized: each call waits for the previous to settle before touching the
// worker. This guarantees single-flight regardless of how the caller behaves,
// preventing cross-run output misattribution and worker termination races.
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./py-worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

function resetWorker(): void {
  worker?.terminate();
  worker = null;
}

/**
 * Run Python fully in the browser via a reused Pyodide Web Worker — no external
 * service. The first call pays the runtime load cost; later calls reuse the warm
 * interpreter with a fresh Python namespace each run. Calls are serialized so
 * the single interpreter never runs two scripts at once.
 *
 * Resolves to the shared `ExecutionResult` shape. A timeout terminates the
 * worker (a busy interpreter can't be interrupted without a SharedArrayBuffer),
 * so the next call reinitializes Pyodide.
 */
export function runPythonInBrowser(
  code: string,
  timeoutMs = 15000
): Promise<ExecutionResult> {
  const run = queue.then(() => execute(code, timeoutMs));
  // `execute` never rejects (it resolves with an error result), but guard the
  // chain anyway so one run can never break serialization for the next.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function execute(code: string, timeoutMs: number): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    let w: Worker;
    try {
      w = getWorker();
    } catch {
      resolve({
        success: false,
        output: '',
        streams: [],
        error: 'In-browser Python is not supported in this environment.',
        executionTime: 0,
      });
      return;
    }

    const id = nextId++;
    const start = performance.now();
    // Set once the runtime is loaded; used so the first-run download isn't
    // counted in the reported execution time.
    let execStart: number | null = null;
    const streams: OutputStream[] = [];
    let totalChars = 0;
    let truncated = false;
    let settled = false;
    const timers: {
      load?: ReturnType<typeof setTimeout>;
      exec?: ReturnType<typeof setTimeout>;
    } = {};

    const cleanup = () => {
      clearTimeout(timers.load);
      clearTimeout(timers.exec);
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
    };

    const finish = (partial: { success: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        success: partial.success,
        output: streams.map((s) => s.content).join('\n'),
        streams,
        error: partial.error,
        executionTime: Math.round(performance.now() - (execStart ?? start)),
      });
    };

    function onMessage(e: MessageEvent<WorkerMessage>) {
      const msg = e.data;
      if (msg.id !== id) return; // ignore messages from other runs
      switch (msg.type) {
        case 'running':
          // Runtime is loaded; start the execution-timeout window and the
          // execution-time clock so the long first-run load isn't counted.
          execStart = performance.now();
          clearTimeout(timers.load);
          timers.exec = setTimeout(() => {
            resetWorker();
            finish({
              success: false,
              error: `Execution timed out after ${timeoutMs}ms (possible infinite loop).`,
            });
          }, timeoutMs);
          break;
        case 'stream':
          if (truncated) return;
          totalChars += msg.content.length;
          if (totalChars > MAX_OUTPUT_CHARS) {
            truncated = true;
            streams.push({
              type: 'stderr',
              content: `[output truncated at ${MAX_OUTPUT_CHARS} characters]`,
            });
            return;
          }
          streams.push({ type: msg.stream, content: msg.content });
          break;
        case 'done':
          finish({ success: msg.success, error: msg.error });
          break;
        case 'load-error':
          // A failed load poisons the cached runtime promise; drop the worker
          // so the next run reinitializes from scratch.
          resetWorker();
          finish({ success: false, error: msg.error });
          break;
      }
    }

    function onError(e: ErrorEvent) {
      resetWorker();
      finish({ success: false, error: e.message || 'Python worker error' });
    }

    timers.load = setTimeout(() => {
      resetWorker();
      finish({
        success: false,
        error: `Timed out loading the Python runtime after ${LOAD_TIMEOUT_MS}ms.`,
      });
    }, LOAD_TIMEOUT_MS);

    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ type: 'run', id, code });
  });
}
