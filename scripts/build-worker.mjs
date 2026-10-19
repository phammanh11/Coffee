import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

await esbuild.build({
  entryPoints: [path.join(rootDir, 'src/worker/index.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  conditions: ['worker', 'browser'],
  outfile: path.join(rootDir, 'dist/_worker.js'),
  minify: true,
  sourcemap: false,
});

console.log('✓ Built Cloudflare Pages Worker bundle: dist/_worker.js');
