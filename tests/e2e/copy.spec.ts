import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const port = (page: Page, code: string) => page.evaluate(code);
const clip = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.locator('math-field').waitFor();
  await page.evaluate(() => {
    const w = window as unknown as { __port: { insert(s: string): void } };
    w.__port.insert('\\frac{#?}{#?}');
  });
  await page.keyboard.type('1');
  await page.locator('.actions').getByRole('button', { name: /次の空欄/ }).click();
  await page.keyboard.type('2');
});

test('Word用は \\frac{1}{2} の形でコピーされる', async ({ page }) => {
  await page.getByRole('button', { name: 'コピー', exact: true }).click();
  await expect(page.getByRole('button', { name: 'コピーしました' })).toBeVisible();
  expect(await clip(page)).toBe('\\frac{1}{2}');
});

test('LaTeX・MathMLに切り替えてコピーでき、最後に選んだ形式を覚える', async ({ page }) => {
  await page.getByLabel('コピーの形式').selectOption('mathml');
  await page.getByRole('button', { name: 'コピー', exact: true }).click();
  expect(await clip(page)).toContain('<math');
  await page.getByLabel('コピーの形式').selectOption('latex');
  await page.reload();
  await expect(page.getByLabel('コピーの形式')).toHaveValue('latex');
});

test('空欄は取り除かれる', async ({ page }) => {
  await page.evaluate(() => (window as unknown as { __port: { insert(s: string): void } }).__port.insert('\\sqrt{#?}'));
  await page.getByRole('button', { name: 'コピー', exact: true }).click();
  expect(await clip(page)).not.toContain('placeholder');
});

test('数式が空のときは案内する', async ({ page }) => {
  await page.evaluate(() => {
    const mf = document.querySelector('math-field') as HTMLElement & { value: string };
    mf.value = '';
  });
  await page.getByRole('button', { name: 'コピー', exact: true }).click();
  await expect(page.locator('#live')).toHaveText('コピーする数式がありません');
});

test('クリップボードが使えないときは、選択状態のテキストを出す', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
  });
  await page.getByRole('button', { name: 'コピー', exact: true }).click();
  const area = page.getByLabel(/コピー用のテキスト/);
  await expect(area).toBeVisible();
  await expect(area).toHaveValue('\\frac{1}{2}');
  expect(await area.evaluate((a: HTMLTextAreaElement) => a.selectionEnd - a.selectionStart)).toBe(11);
  await expect(page.locator('#live')).toContainText('Ctrl＋C');
});

test('「Wordで使う方法」が開き、手順が読める。axe違反なし', async ({ page }) => {
  await page.getByRole('button', { name: 'Wordで使う方法' }).click();
  const d = page.locator('#help');
  await expect(d).toContainText('Alt');
  await expect(d).toContainText('すべて - 2次元形式');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('メイン画面のaxe違反なし', async ({ page }) => {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('Word互換テストページ：全キーが並び、コピーと記録ができる', async ({ page }) => {
  await page.goto('/dev/word-test.html');
  await page.locator('table.wt tbody tr').first().waitFor();
  expect(await page.locator('table.wt tbody tr').count()).toBeGreaterThan(100);
  const row = page.locator('table.wt tbody tr', { hasText: 'basic-10' }).filter({ hasText: '上' });
  await expect(row.locator('code')).toHaveText('\\frac{}{}');
  await row.getByRole('button', { name: /Word用をコピー/ }).click();
  expect(await clip(page)).toBe('\\frac{}{}');
  await row.getByRole('combobox').selectOption('OK');
  await page.reload();
  await page.locator('table.wt tbody tr').first().waitFor();
  await expect(page.locator('table.wt tbody tr', { hasText: 'basic-10' }).filter({ hasText: '上' }).getByRole('combobox')).toHaveValue('OK');
  await page.getByRole('button', { name: /Markdownの表/ }).click();
  await expect(page.getByLabel('Markdownの表')).toHaveValue(/\| basic-10\.u \| 上 \| 分数 \|.*\| OK \|/);
});
