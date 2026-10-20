import { defineConfig, devices } from '@playwright/test';

// 本番ビルドを配信して、オフライン動作とPWAの設定を確かめる
export default defineConfig({
  testDir: 'tests/pwa',
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: false, timeout: 120_000 },
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'allow' },
  projects: [{ name: 'pwa', use: { ...devices['Desktop Chrome'], hasTouch: true, viewport: { width: 1180, height: 820 } } }],
});
