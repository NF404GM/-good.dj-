import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    server: {
      port: 5173,
      host: '0.0.0.0',
    },
    define: {
      'import.meta.env.VITE_GUMROAD_PRODUCT_ID': JSON.stringify(env.VITE_GUMROAD_PRODUCT_ID ?? ''),
    },
    plugins: [react()],
    worker: {
      format: 'es',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    optimizeDeps: {
      exclude: ['signalsmith-stretch']
    }
  };
});
