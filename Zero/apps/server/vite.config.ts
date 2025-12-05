import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': resolve(__dirname, './src/__mocks__/cloudflare-workers.ts'),
    },
  },
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 120000,
  },
}); 