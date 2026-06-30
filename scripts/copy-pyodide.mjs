// Copies the minimal Pyodide runtime into public/pyodide/ so Python can run
// fully in the browser with no external CDN/API dependency. Runs on postinstall;
// the copied assets are gitignored and regenerated from node_modules on install.
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

let pyodideDir;
try {
  pyodideDir = dirname(require.resolve('pyodide/package.json'));
} catch {
  console.warn('[copy-pyodide] pyodide not installed; skipping asset copy.');
  process.exit(0);
}

// Core runtime only (stdlib Python, no third-party packages) — keeps the
// payload to ~12 MB and avoids hosting the full package set.
const FILES = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

const dest = join(repoRoot, 'public', 'pyodide');
mkdirSync(dest, { recursive: true });

let copied = 0;
for (const file of FILES) {
  const src = join(pyodideDir, file);
  if (!existsSync(src)) {
    console.warn(`[copy-pyodide] missing ${file} in pyodide dist; skipping.`);
    continue;
  }
  copyFileSync(src, join(dest, file));
  copied += 1;
}

console.log(`[copy-pyodide] copied ${copied}/${FILES.length} files to public/pyodide/`);
