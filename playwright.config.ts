import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: { command: 'npm run dev -- --port 5173', url: 'http://localhost:5173', reuseExistingServer: true },
  use: { baseURL: 'http://localhost:5173' },
  // WebKit(iPad)の実機相当確認は人が行う。自動テストはタッチ有効のChromiumで行う
  projects: [{ name: 'tablet', use: { ...devices['Desktop Chrome'], hasTouch: true, viewport: { width: 1180, height: 820 } } }],
});
