// Native ES-module Web Worker that runs Python via Pyodide (CPython -> WASM),
// loaded from self-hosted assets in /public/pyodide — no external CDN/API.
//
// WHY THIS LIVES IN /public AS PLAIN ESM (not a bundled TS worker):
// Pyodide REQUIRES a module-type worker ("Classic web workers are not
// supported" — it relies on ES modules). Next dev's Turbopack bundles
// `new Worker(new URL('./x.ts', import.meta.url), { type: 'module' })` as a
// CLASSIC worker regardless of the option, so Pyodide's isClassicWorker() probe
// (which calls globalThis.importScripts) succeeds and it refuses to run.
// Serving this worker as a static /public/*.mjs and instantiating it with
// `new Worker(url, { type: 'module' })` gives a genuine browser-native module
// worker that Turbopack never touches — importScripts is truly absent, so the
// probe fails and Pyodide loads via the module path. See src/lib/execution/py-runner.ts.
//
// Pyodide is expensive to initialize (~seconds), so this worker is a long-lived
// singleton (see py-runner): Pyodide loads once and is reused across runs.
// Per-run isolation comes from a fresh Python namespace each run rather than a
// fresh worker. The driver terminates this worker only on timeout (an infinite
// loop can't be interrupted without a SharedArrayBuffer + cross-origin
// isolation, which this app does not enable), after which the next run
// reinitializes.
//
// Output capture note: Pyodide's stream buffer lives on the shared interpreter,
// not the per-run namespace. A batched (newline-only) handler therefore (a)
// drops a final line that has no trailing newline and (b) leaks a partial line
// into the NEXT run. We instead capture raw bytes, split on newlines ourselves,
// and flush + clear the buffer at the end of every run.

import { loadPyodide } from '/pyodide/pyodide.mjs';

// The run currently executing. Runs are serialized one at a time by the driver
// (single-flight), so this is never overwritten mid-run.
let currentId = null;

// Per-stream line buffers + decoders. Reset at the end of each run.
const stdoutDecoder = new TextDecoder();
const stderrDecoder = new TextDecoder();
let stdoutBuf = '';
let stderrBuf = '';

const emit = (stream, content) => {
  if (currentId === null) return;
  self.postMessage({ type: 'stream', id: currentId, stream, content });
};

// Raw stdout/stderr write handler: accumulate bytes, emit each complete line,
// keep the trailing partial in the buffer until the next write or a flush.
function feed(stream, bytes) {
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

const describe = (err) =>
  err instanceof Error ? err.message : String(err);

// A Pyodide PythonError's message is the full traceback, which begins with the
// interpreter's own eval_code_async/run_async frames. Strip everything between
// the "Traceback" header and the user's first `File "<exec>"` frame so a learner
// sees their own code, not the harness plumbing.
function formatPythonError(err) {
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
function flush(pyodide) {
  try {
    pyodide.runPython('import sys; sys.stdout.flush(); sys.stderr.flush()');
  } catch {
    // ignore — flushBuffers still emits whatever already reached us
  }
  flushBuffers();
}

// Load Pyodide once from the self-hosted /public/pyodide assets.
const ready = (async () => {
  const indexURL = new URL('/pyodide/', self.location.origin).href;
  const pyodide = await loadPyodide({ indexURL });
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

self.onmessage = async (event) => {
  const { id, code } = event.data;
  currentId = id;

  let pyodide;
  try {
    pyodide = await ready;
  } catch (err) {
    self.postMessage({
      type: 'load-error',
      id,
      error: `Failed to load the Python runtime: ${describe(err)}`,
    });
    currentId = null;
    return;
  }

  // Loading is done; signal the driver to switch from the load timeout to the
  // (shorter) execution timeout and to time only the run itself.
  self.postMessage({ type: 'running', id });

  // Fresh namespace per run so names/side effects don't leak between runs.
  const globals = pyodide.globals.get('dict')();
  try {
    await pyodide.runPythonAsync(code, { globals });
    flush(pyodide); // emit any buffered output BEFORE posting `done`
    self.postMessage({ type: 'done', id, success: true });
  } catch (err) {
    flush(pyodide);
    self.postMessage({
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
