/// <reference lib="webworker" />

// Web Worker that runs learner/instructor JavaScript in an isolated thread.
//
// Running in a Worker (rather than the main thread) means an infinite loop
// freezes a throwaway thread, not the editor — the driver terminates it on
// timeout. The Worker has no DOM access; `console.*` is captured and streamed
// back line-by-line so partial output survives a timeout.

export {};

const ctx = self as unknown as DedicatedWorkerGlobalScope;

type IncomingMessage = { code: string };

/** Render a console argument the way a dev console roughly would. */
function format(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(
        value,
        (_key, v) => (typeof v === 'bigint' ? v.toString() : v),
        2
      );
    } catch {
      return String(value);
    }
  }
  return String(value);
}

ctx.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const { code } = event.data;

  const emit = (stream: 'stdout' | 'stderr', content: string) =>
    ctx.postMessage({ type: 'log', stream, content });
  const out = (...args: unknown[]) => emit('stdout', args.map(format).join(' '));
  const err = (...args: unknown[]) => emit('stderr', args.map(format).join(' '));

  // Sandboxed console — shadows the real console inside the user's code.
  // warn/error go to stderr so the output panel can style them distinctly.
  const sandboxConsole = {
    log: out,
    info: out,
    debug: out,
    table: (value: unknown) => emit('stdout', format(value)),
    warn: err,
    error: err,
  };

  try {
    // Wrap the snippet in an async IIFE so top-level `await` works for
    // learners. Syntax errors throw synchronously from `new Function`;
    // runtime errors reject the returned promise — both land in catch.
    const runner = new Function(
      'console',
      `"use strict"; return (async () => {\n${code}\n})();`
    );
    await runner(sandboxConsole);
    ctx.postMessage({ type: 'done', success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.stack || err.message : String(err);
    ctx.postMessage({ type: 'done', success: false, error: message });
  }
};
