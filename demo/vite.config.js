import { defineConfig } from 'vite';

import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        classic: resolve(__dirname, 'classic.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: true
  },
  test: {
    // Property-based tests (fast-check) construct the DOM hundreds of times
    // per case, so allow more than the 5s default to avoid flaky timeouts.
    testTimeout: 20000,
  },
});
