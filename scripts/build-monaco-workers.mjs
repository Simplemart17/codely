// Bundles Monaco Editor's language workers into self-contained files under
// public/monaco so they can be loaded as plain static Web Workers.
//
// WHY: Monaco runs language services (diagnostics, IntelliSense) in Web Workers.
// The workers under monaco-editor/esm/vs/**/ *.worker.js are ES modules with
// internal imports, so they can't be loaded directly. Letting Next/Turbopack
// bundle them via `new Worker(new URL('monaco-editor/.../ts.worker.js', import.meta.url))`
// breaks in dev: Turbopack injects its React Fast Refresh helper (`_s`) into the
// worker bundle, and that global doesn't exist in a worker → "TypeError: _s is
// not a function" and the TypeScript worker dies. Bundling the workers here with
// esbuild produces standalone classic-worker files that Turbopack never touches,
// so `new Worker('/monaco/ts.worker.js')` just works (see src/components/editor/monaco-editor.tsx).
//
// Output is git-ignored and regenerated on `postinstall` (alongside the
// self-hosted Pyodide runtime), so it always matches the installed
// monaco-editor version.

import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Only JavaScript/TypeScript and the base editor need workers here (Python uses
// main-thread basic-languages). Add json/css/html workers if those languages
// are ever enabled.
const entryPoints = {
  'editor.worker':
    require.resolve('monaco-editor/esm/vs/editor/editor.worker.js'),
  'ts.worker':
    require.resolve('monaco-editor/esm/vs/language/typescript/ts.worker.js'),
};

await esbuild.build({
  entryPoints,
  bundle: true,
  format: 'iife', // classic worker — loaded with `new Worker(url)` (no type: module)
  platform: 'browser',
  outdir: resolve(root, 'public/monaco'),
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});

console.log('✓ Monaco workers bundled to public/monaco/');
