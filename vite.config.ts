import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/** 画面に出す版の目印（どの版が表示されているか分かるように） */
function buildId() {
  let sha = process.env.GITHUB_SHA?.slice(0, 7);
  try {
    sha ??= execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    /* git がなければ日時だけ */
  }
  const day = new Date().toISOString().slice(0, 10);
  return `${sha ?? 'dev'} (${day})`;
}

export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  build: {
    rollupOptions: {
      // 本番のメニューには出さないが、URLを直接開けるように一緒にビルドする
      input: { main: resolve(__dirname, 'index.html'), wordTest: resolve(__dirname, 'dev/word-test.html') },
    },
  },
  plugins: [
    VitePWA({
      // 新しい版は、見つかり次第Service Workerを入れ替える。ただし開いているページは再読み込みしない
      // （入力中の数式が消えないように）。次に開いた・再読み込みしたときから新しい版になる
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
        skipWaiting: true,
        clientsClaim: true,
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
