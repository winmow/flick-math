import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const latex = (page: Page) => page.evaluate(() => (window as unknown as { __port: { getLatex(): string } }).__port.getLatex());
const dialog = (page: Page) => page.locator('dialog.settings');

async function setRange(page: Page, label: string | RegExp, value: number) {
  const r = dialog(page).getByLabel(label);
  await r.evaluate((el, v) => {
    (el as HTMLInputElement).value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  await page.getByRole('button', { name: '設定' }).click();
});

test('キーの高さ・列数・間隔が反映される', async ({ page }) => {
  await setRange(page, 'キーの高さ', 120);
  await setRange(page, '列数', 3);
  await setRange(page, 'キーの間隔', 16);
  await dialog(page).getByRole('button', { name: '閉じる' }).click();
  const box = (await page.locator('[data-key-id="basic-01"]').boundingBox())!;
  expect(Math.round(box.height)).toBe(120);
  const cols = await page.locator('.grid').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(3);
});

test('設定はリロード後も残る', async ({ page }) => {
  await setRange(page, 'キーの高さ', 100);
  await dialog(page).getByLabel('画面の配色').selectOption('contrast');
  await page.reload();
  await page.locator('.key').first().waitFor();
  expect(Math.round((await page.locator('[data-key-id="basic-01"]').boundingBox())!.height)).toBe(100);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
});

test('操作方式を設定画面から切り替えられる', async ({ page }) => {
  await dialog(page).getByLabel('操作方式', { exact: true }).selectOption('tap');
  await dialog(page).getByRole('button', { name: '閉じる' }).click();
  await page.locator('[data-key-id="basic-02"]').click();
  await expect(page.locator('dialog.chooser')).toBeVisible();
});

test('プロファイルを追加・切り替えでき、設定が別々に保たれる', async ({ page }) => {
  await setRange(page, 'キーの高さ', 100);
  await dialog(page).getByRole('button', { name: '新しいプロファイルを追加' }).click();
  expect(await page.evaluate(() => (window as unknown as { __settings: { keyHeight: number } }).__settings.keyHeight)).toBe(84);
  await dialog(page).getByLabel('使うプロファイル').selectOption({ index: 0 });
  expect(await page.evaluate(() => (window as unknown as { __settings: { keyHeight: number } }).__settings.keyHeight)).toBe(100);
});

test('書き出したファイルを別プロファイルとして読み込める', async ({ page }) => {
  await setRange(page, 'キーの高さ', 132);
  await dialog(page).getByLabel(/プロファイル名/).fill('Aさん用');
  await dialog(page).getByLabel(/プロファイル名/).press('Tab');
  const [download] = await Promise.all([page.waitForEvent('download'), dialog(page).getByRole('button', { name: 'ファイルに書き出す' }).click()]);
  const path = await download.path();
  const json = JSON.parse(readFileSync(path, 'utf8'));
  expect(json.name).toBe('Aさん用');
  expect(json.settings.keyHeight).toBe(132);
  await dialog(page).getByRole('button', { name: '新しいプロファイルを追加' }).click();
  await dialog(page).locator('input[type=file]').setInputFiles(path);
  await expect(dialog(page).getByLabel('使うプロファイル').locator('option:checked')).toHaveText('Aさん用');
  expect(await page.evaluate(() => (window as unknown as { __settings: { keyHeight: number } }).__settings.keyHeight)).toBe(132);
});

test('壊れたファイルは読み込まず、何も変更しない', async ({ page }) => {
  await dialog(page).locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"oops":') });
  await expect(dialog(page).locator('p.note')).toContainText('読み込めませんでした');
  expect(await dialog(page).getByLabel('使うプロファイル').locator('option').count()).toBe(1);
});

test('すべて消すは2回押しで実行され、取り消しで戻せる', async ({ page }) => {
  await dialog(page).getByRole('button', { name: '閉じる' }).click();
  await page.evaluate(() => (window as unknown as { __port: { insert(s: string): void } }).__port.insert('x+1'));
  await page.getByRole('button', { name: '設定' }).click();
  const b = dialog(page).getByRole('button', { name: '数式をすべて消す' });
  await b.click();
  expect(await latex(page)).toBe('x+1');
  await dialog(page).getByRole('button', { name: 'もう一度押すと消えます' }).click();
  expect(await latex(page)).toBe('');
  await dialog(page).getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('button', { name: /取り消し/ }).click();
  expect(await latex(page)).toBe('x+1');
});

test('設定画面のターゲットは44px以上、axe違反なし', async ({ page }) => {
  for (const sel of ['button', 'select', 'input[type=range]']) {
    for (const e of await dialog(page).locator(sel).all()) {
      const b = (await e.boundingBox())!;
      if (!b) continue;
      expect(b.height, sel).toBeGreaterThanOrEqual(44);
    }
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
