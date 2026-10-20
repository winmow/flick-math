import { resolve } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      // 本番のメニューには出さないが、URLを直接開けるように一緒にビルドする
      input: { main: resolve(__dirname, 'index.html'), wordTest: resolve(__dirname, 'dev/word-test.html') },
    },
  },
  plugins: [
    VitePWA({
      // 新しい版は、すべてのタブを閉じて開き直したときに有効になる（入力中に勝手に再読み込みしない）
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/icon.svg', 'fonts/*.woff2'],
      manifest: {
        name: 'フリック数式パッド',
        short_name: 'フリック数式',
        description: '大きなキーのフリック操作で数式を入力し、Wordなどに貼り付けるアプリ',
        lang: 'ja',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#0B6B86',
        background_color: '#EEF3F4',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        navigateFallbackDenylist: [/\/dev\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/*.test.ts'],
  },
});
