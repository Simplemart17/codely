import type { ExecutionResult, OutputStream } from '../code-execution';

type WorkerMessage =
  | { type: 'log'; stream: 'stdout' | 'stderr'; content: string }
  | { type: 'done'; success: boolean; error?: string };

/**
 * Cap on total captured output characters. Protects against a runaway
 * `console.log` loop building an unbounded array and producing a broadcast
 * payload that would exceed the realtime message size limit. The timeout
 * still bounds CPU; this bounds memory and payload size.
 */
const MAX_OUTPUT_CHARS = 50_000;

/**
 * Run JavaScript fully in the browser via a Web Worker — no external service.
 *
 * A fresh Worker is spun up per run (and terminated after) on purpose: it
 * guarantees each run starts from clean global state, so variables/side effects
 * from one run can't leak into the next. Reusing a worker would be marginally
 * faster but would break that isolation.
 *
 * Output is accumulated as the Worker streams `console.*` calls, so a snippet
 * that times out (e.g. an infinite loop) still shows whatever it logged before
 * being terminated. Resolves to the shared `ExecutionResult` shape so it drops
 * into the existing run pipeline unchanged.
 */
export function runJavaScriptInBrowser(
  code: string,
  timeoutMs = 10000
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const streams: OutputStream[] = [];
    let totalChars = 0;
    let truncated = false;
    let settled = false;

    let worker: Worker;
    try {
      worker = new Worker(new URL('./js-worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      resolve({
        success: false,
        output: '',
        streams: [],
        error: 'In-browser execution is not supported in this environment.',
        executionTime: 0,
      });
      return;
    }

    const finish = (partial: { success: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve({
        success: partial.success,
        output: streams.map((s) => s.content).join('\n'),
        streams,
        error: partial.error,
        executionTime: Math.round(performance.now() - start),
      });
    };

    const timer = setTimeout(() => {
      finish({
        success: false,
        error: `Execution timed out after ${timeoutMs}ms (possible infinite loop).`,
      });
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'log') {
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
      } else if (msg.type === 'done') {
        finish({ success: msg.success, error: msg.error });
      }
    };

    worker.onerror = (e: ErrorEvent) => {
      finish({ success: false, error: e.message || 'Worker error' });
    };

    worker.postMessage({ code });
  });
}
