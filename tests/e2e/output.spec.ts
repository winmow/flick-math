import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

type Win = { __port: { insert(s: string): void; getLatex(): string } };

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('math-field').waitFor();
});

test('分数→1→次の空欄→2 で \\frac{1}{2} ができる', async ({ page }) => {
  await page.evaluate(() => (window as unknown as Win).__port.insert('\\frac{#?}{#?}'));
  await page.keyboard.type('1');
  await page.locator('.actions').getByRole('button', { name: /次の空欄/ }).tap();
  await page.keyboard.type('2');
  const latex = await page.evaluate(() => (window as unknown as Win).__port.getLatex());
  // MathLiveは \frac12 と短縮して出力する。Word向けに \frac{1}{2} へ正規化するのは段階7で行う
  expect(latex).toMatch(/^\\frac(\{1\}\{2\}|12)$/);
});

test('1つ消す・取り消しが動く', async ({ page }) => {
  const get = () => page.evaluate(() => (window as unknown as Win).__port.getLatex());
  await page.evaluate(() => (window as unknown as Win).__port.insert('12'));
  await page.locator('.actions').getByRole('button', { name: /1つ消す/ }).tap();
  expect(await get()).toBe('1');
  await page.locator('.actions').getByRole('button', { name: /取り消し/ }).tap();
  expect(await get()).toBe('12');
});

test('OSキーボード抑止の属性が付いている', async ({ page }) => {
  await expect(page.locator('math-field')).toHaveAttribute('inputmode', 'none');
  expect(await page.evaluate(() => window.mathVirtualKeyboard?.visible ?? false)).toBe(false);
});

test('axe違反なし', async ({ page }) => {
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations).toEqual([]);
});
