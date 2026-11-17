import { build } from 'vite';
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(), clientDir = path.join(root, 'lab/generated/client');
await rm(path.join(root, 'lab/generated'), { recursive: true, force: true });
await mkdir(path.join(root, 'lab/generated'), { recursive: true });
await build({ configFile: false, root: path.join(root, 'lab'), build: { outDir: clientDir, emptyOutDir: true }, resolve: { alias: { '@': path.join(root, 'src') } } });
const files = {};
async function collect(dir, relative = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = path.posix.join(relative, entry.name), full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collect(full, rel);
    else { const ext = path.extname(rel); files['/' + rel] = { type: ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: await readFile(full, 'utf8') }; }
  }
}
await collect(clientDir);
await writeFile(path.join(root, 'lab/generated/assets.json'), JSON.stringify(files));
await build({ configFile: false, build: { ssr: path.join(root, 'lab/worker.ts'), outDir: path.join(root, 'dist/server'), emptyOutDir: true, rolldownOptions: { output: { entryFileNames: 'index.js', inlineDynamicImports: true } } }, ssr: { noExternal: true } });
