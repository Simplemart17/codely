/// <reference lib="webworker" />

// Web Worker that runs Python via Pyodide (CPython compiled to WASM), loaded
// from self-hosted assets in /public/pyodide — no external CDN/API.
//
// Unlike the JS worker, Pyodide is expensive to initialize (~seconds), so this
// worker is a long-lived singleton (see py-runner): Pyodide loads once and is
// reused across runs. Per-run isolation comes from a fresh Python namespace
// each run rather than a fresh worker. The driver terminates this worker only
// on timeout (an infinite loop can't be interrupted without a SharedArrayBuffer
// + cross-origin isolation, which this app does not enable), after which the
// next run reinitializes.
//
// Output capture note: Pyodide's stream buffer lives on the shared interpreter,
// not the per-run namespace. A batched (newline-only) handler therefore (a)
// drops a final line that has no trailing newline and (b) leaks a partial line
// into the NEXT run. We instead capture raw bytes, split on newlines ourselves,
// and flush + clear the buffer at the end of every run.

export {};

const ctx = self as unknown as DedicatedWorkerGlobalScope;

// Turbopack (next dev --turbopack) emits this worker as a CLASSIC worker even
// though py-runner requests `{ type: 'module' }`. Pyodide refuses to run in a
// classic worker — it probes `globalThis.importScripts` and throws "Classic web
// workers are not supported" — and our self-hosted runtime ships only the ESM
// build (pyodide.asm.mjs, no classic pyodide.asm.js), so the classic path can't
// load anyway. Hiding importScripts makes Pyodide's isClassicWorker() probe
// fail, routing it to the module path, which loads the runtime via dynamic
// import() — and dynamic import() works inside a classic worker on modern
// browsers. In a real module worker importScripts is already absent, so this is
// a harmless no-op there (keeps `next build` / webpack correct too).
if (typeof (ctx as { importScripts?: unknown }).importScripts === 'function') {
  Object.defineProperty(ctx, 'importScripts', {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

interface PyProxyDict {
  destroy(): void;
}
interface PyodideAPI {
  runPython(code: string): unknown;
  runPythonAsync(code: string, options?: { globals?: unknown }): Promise<unknown>;
  globals: { get(name: 'dict'): () => PyProxyDict };
  setStdout(options: { write: (buffer: Uint8Array) => number }): void;
  setStderr(options: { write: (buffer: Uint8Array) => number }): void;
}
interface PyodideModule {
  loadPyodide(options: { indexURL: string }): Promise<PyodideAPI>;
}

type RunMessage = { type: 'run'; id: number; code: string };

// The run currently executing. Runs are serialized one at a time by the driver
// (single-flight), so this is never overwritten mid-run.
let currentId: number | null = null;

// Per-stream line buffers + decoders. Reset at the end of each run.
const stdoutDecoder = new TextDecoder();
const stderrDecoder = new TextDecoder();
let stdoutBuf = '';
let stderrBuf = '';

const emit = (stream: 'stdout' | 'stderr', content: string) => {
  if (currentId === null) return;
  ctx.postMessage({ type: 'stream', id: currentId, stream, content });
};

// Raw stdout/stderr write handler: accumulate bytes, emit each complete line,
// keep the trailing partial in the buffer until the next write or a flush.
function feed(stream: 'stdout' | 'stderr', bytes: Uint8Array): number {
  const decoder = stream === 'stdout' ? stdoutDecoder : stderrDecoder;
  const prev = stream === 'stdout' ? stdoutBuf : stderrBuf;
  const text = prev + decoder.decode(bytes, { stream: true });
  const parts = text.split('\n');
  const remainder = parts.pop() ?? '';
  for (const line of parts) emit(stream, line);
  if (stream === 'stdout') stdoutBuf = remainder;
  else stderrBuf = remainder;
  return bytes.length;
}

// Emit any trailing partial line and clear the buffers.
function flushBuffers() {
  if (stdoutBuf) {
    emit('stdout', stdoutBuf);
    stdoutBuf = '';
  }
  if (stderrBuf) {
    emit('stderr', stderrBuf);
    stderrBuf = '';
  }
}

const describe = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

// A Pyodide PythonError's message is the full traceback, which begins with the
// interpreter's own eval_code_async/run_async frames. Strip everything between
// the "Traceback" header and the user's first `File "<exec>"` frame so a learner
// sees their own code, not the harness plumbing.
function formatPythonError(err: unknown): string {
  const raw = describe(err);
  if (!raw.startsWith('Traceback')) return raw;
  const lines = raw.split('\n');
  const firstUserFrame = lines.findIndex((line) =>
    line.includes('File "<exec>"')
  );
  if (firstUserFrame <= 0) return raw;
  return [lines[0], ...lines.slice(firstUserFrame)].join('\n');
}

// Push CPython's own buffer out to our write handler, then emit any partial
// tail. Done at the end of each run so a final unterminated line isn't lost.
function flush(pyodide: PyodideAPI) {
  try {
    pyodide.runPython('import sys; sys.stdout.flush(); sys.stderr.flush()');
  } catch {
    // ignore — flushBuffers still emits whatever already reached us
  }
  flushBuffers();
}

// Load Pyodide once. The dynamic import uses a runtime-built specifier (with
// bundler-ignore hints) so the ~12 MB runtime is fetched from /public at
// runtime rather than pulled into the bundle.
const ready: Promise<PyodideAPI> = (async () => {
  const indexURL = new URL('/pyodide/', ctx.location.origin).href;
  const mod = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ `${indexURL}pyodide.mjs`
  )) as PyodideModule;
  const pyodide = await mod.loadPyodide({ indexURL });
  pyodide.setStdout({ write: (bytes) => feed('stdout', bytes) });
  pyodide.setStderr({ write: (bytes) => feed('stderr', bytes) });
  // Line-buffer Python's own streams so each `print` flushes per line — output
  // streams live and partial output survives a timeout. Best-effort.
  try {
    pyodide.runPython(
      'import sys\nsys.stdout.reconfigure(line_buffering=True)\nsys.stderr.reconfigure(line_buffering=True)'
    );
  } catch {
    // Runtimes without reconfigure() still get a correct end-of-run flush.
  }
  return pyodide;
})();

ctx.onmessage = async (event: MessageEvent<RunMessage>) => {
  const { id, code } = event.data;
  currentId = id;

  let pyodide: PyodideAPI;
  try {
    pyodide = await ready;
  } catch (err) {
    ctx.postMessage({
      type: 'load-error',
      id,
      error: `Failed to load the Python runtime: ${describe(err)}`,
    });
    currentId = null;
    return;
  }

  // Loading is done; signal the driver to switch from the load timeout to the
  // (shorter) execution timeout and to time only the run itself.
  ctx.postMessage({ type: 'running', id });

  // Fresh namespace per run so names/side effects don't leak between runs.
  const globals = pyodide.globals.get('dict')();
  try {
    await pyodide.runPythonAsync(code, { globals });
    flush(pyodide); // emit any buffered output BEFORE posting `done`
    ctx.postMessage({ type: 'done', id, success: true });
  } catch (err) {
    flush(pyodide);
    ctx.postMessage({
      type: 'done',
      id,
      success: false,
      error: formatPythonError(err),
    });
  } finally {
    // Defensive: never let buffered text survive into the next run.
    stdoutBuf = '';
    stderrBuf = '';
    globals.destroy();
    currentId = null;
  }
};
