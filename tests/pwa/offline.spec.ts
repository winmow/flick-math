import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('マニフェストとアイコンが正しい', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const res = await request.get(new URL(href!, page.url()).href);
  const m = await res.json();
  expect(m.display).toBe('standalone');
  expect(m.lang).toBe('ja');
  expect(m.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ':' + i.purpose : ''}`)).toEqual(['192x192', '512x512', '512x512:maskable']);
  for (const i of m.icons) expect((await request.get(new URL(i.src, page.url()).href)).ok()).toBe(true);
});

test('一度開けば、オフラインでも起動して入力・コピー用の出力ができる', async ({ page, context }) => {
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  // Service Worker が有効になり、ページを管理するまで待つ
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await page.locator('.key').first().waitFor();
  await page.locator('[data-key-id="basic-01"]').click();
  expect(await page.evaluate(() => (window as unknown as { __port: { getLatex(): string } }).__port.getLatex())).toBe('7');

  // 数式フォントも同梱されている（CDNを使わない）
  const fontOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px KaTeX_Main');
  });
  expect(fontOk).toBe(true);

  // Word互換ページもオフラインで開ける
  await page.goto('/dev/word-test.html');
  await expect(page.locator('table.wt tbody tr').first()).toBeVisible();
});

test('外部への通信が一切ない', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin !== 'http://localhost:4173' && u.protocol.startsWith('http')) external.push(r.url());
  });
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  await page.getByRole('button', { name: '設定' }).click();
  await page.waitForTimeout(500);
  expect(external).toEqual([]);
});

test('本番用のCSP(public/_headers)を付けても、画面・入力・設定・キー編集が動く', async ({ page }) => {
  const headers = readFileSync('public/_headers', 'utf8');
  const csp = headers.match(/Content-Security-Policy: (.+)/)![1];
  await page.route('**/*', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': csp } });
  });
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|violat/i.test(m.text())) violations.push(m.text());
  });
  page.on('pageerror', (e) => violations.push(e.message));
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  await page.evaluate(() => Object.assign((window as unknown as { __settings: object }).__settings, { guardMs: 0 }));
  await page.locator('[data-key-id="basic-01"]').click();
  expect(await page.evaluate(() => (window as unknown as { __port: { getLatex(): string } }).__port.getLatex())).toBe('7');
  await page.getByRole('button', { name: '設定' }).click();
  await page.locator('#settings').getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('button', { name: 'キーを編集' }).click();
  await page.locator('[data-key-id="basic-02"]').click();
  await page.locator('#key-editor').getByLabel('中央のLaTeX').fill('\\frac{1}{2}');
  await expect(page.locator('#key-editor .preview').first()).not.toBeEmpty();
  expect(violations).toEqual([]);
});

test('新しい版は待たずに有効になる設定で、設定画面に版が出る', async ({ page }) => {
  const sw = readFileSync('dist/sw.js', 'utf8');
  expect(sw).toMatch(/skipWaiting\(\)/);
  expect(sw).toMatch(/clientsClaim\(\)|clients\.claim\(\)/);
  await page.goto('/');
  await page.getByRole('button', { name: '設定' }).click();
  await expect(page.locator('#settings [data-build]')).toContainText(/アプリの版：[0-9a-f]{7} \(\d{4}-\d{2}-\d{2}\)/);
});
