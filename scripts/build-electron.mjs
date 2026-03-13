import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';
import { loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const env = loadEnv(process.env.NODE_ENV ?? 'production', projectRoot, '');

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  external: ['electron', '@prisma/client', 'onnxruntime-node', 'node-web-audio-api', 'prolink-connect'],
  define: {
    'process.env.VITE_GUMROAD_PRODUCT_ID': JSON.stringify(env.VITE_GUMROAD_PRODUCT_ID ?? ''),
  },
  absWorkingDir: projectRoot,
};

await Promise.all([
  build({
    ...shared,
    format: 'esm',
    entryPoints: ['electron/main.ts'],
    outfile: 'electron-dist/main.js',
  }),
  build({
    ...shared,
    format: 'cjs',
    entryPoints: ['electron/preload.ts'],
    outfile: 'electron-dist/preload.js',
  }),
  build({
    ...shared,
    format: 'esm',
    entryPoints: ['electron/license.ts'],
    outfile: 'electron-dist/license.js',
  }),
]);
