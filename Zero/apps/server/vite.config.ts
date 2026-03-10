import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': resolve(__dirname, './src/__mocks__/cloudflare-workers.ts'),
    },
    dedupe: ['ansi-styles'],
  },
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 120000,
    server: {
      deps: {
        inline: ['ansi-styles', '@langchain/core'],
      },
    },
  },
});
