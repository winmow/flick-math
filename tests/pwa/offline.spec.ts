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
