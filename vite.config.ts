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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            const normalizedId = id.split(path.sep).join('/');

            if (
              normalizedId.includes('/react/')
              || normalizedId.includes('/react-dom/')
              || normalizedId.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }

            if (normalizedId.includes('/framer-motion/')) {
              return 'vendor-motion';
            }

            if (
              normalizedId.includes('/signalsmith-stretch/')
              || normalizedId.includes('/tunajs/')
            ) {
              return 'vendor-audio-dsp';
            }

            if (
              normalizedId.includes('/immer/')
              || normalizedId.includes('/p-queue/')
            ) {
              return 'vendor-utils';
            }

            return undefined;
          },
        },
      },
    },
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
