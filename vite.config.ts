import { defineConfig } from 'vitest/config';

import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      // 本番のメニューには出さないが、URLを直接開けるように一緒にビルドする
      input: { main: resolve(__dirname, 'index.html'), wordTest: resolve(__dirname, 'dev/word-test.html') },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/*.test.ts'],
  },
});
