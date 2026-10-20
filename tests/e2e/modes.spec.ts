import { expect, test, type Page } from '@playwright/test';

const latex = (page: Page) => page.evaluate(() => (window as unknown as { __port: { getLatex(): string } }).__port.getLatex());
const setSettings = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((v) => Object.assign((window as unknown as { __settings: object }).__settings, v), s);
const key = (page: Page, id: string) => page.locator(`[data-key-id="${id}"]`);

async function press(page: Page, id: string, holdMs = 0, dx = 0, dy = 0) {
  const box = (await key(page, id).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (dx || dy) await page.mouse.move(x + dx, y + dy, { steps: 4 });
  if (holdMs) await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.key').first().waitFor();
});

test('連続タッチを無視する(二度押し防止)', async ({ page }) => {
  await setSettings(page, { guardMs: 600 });
  await press(page, 'basic-01');
  await press(page, 'basic-01'); // 無視される
  expect(await latex(page)).toBe('7');
  await page.waitForTimeout(650);
  await press(page, 'basic-01');
  expect(await latex(page)).toBe('77');
});

test('最短押下時間より短い接触は入力しない', async ({ page }) => {
  await setSettings(page, { guardMs: 0, minPressMs: 300 });
  await press(page, 'basic-01', 0);
  expect(await latex(page)).toBe('');
  await press(page, 'basic-01', 350);
  expect(await latex(page)).toBe('7');
});

test('押し続けて取り消し', async ({ page }) => {
  await setSettings(page, { guardMs: 0, holdCancelMs: 1000 });
  await press(page, 'basic-01', 1100);
  expect(await latex(page)).toBe('');
  await press(page, 'basic-01', 0);
  expect(await latex(page)).toBe('7');
});

test('タップして選ぶ: タップで選択画面→候補を選ぶ', async ({ page }) => {
  await setSettings(page, { guardMs: 0, mode: 'tap' });
  await press(page, 'basic-02');
  await expect(page.locator('dialog.chooser')).toBeVisible();
  expect(await latex(page)).toBe('');
  await page.locator('dialog.chooser').getByRole('button', { name: '右 y' }).click();
  expect(await latex(page)).toBe('y');
  await expect(page.locator('dialog.chooser')).toBeHidden();
});

test('タップして選ぶ: やめるで何も入力しない。フリックは直接入力', async ({ page }) => {
  await setSettings(page, { guardMs: 0, mode: 'tap' });
  await press(page, 'basic-02');
  await page.getByRole('button', { name: 'やめる' }).click();
  expect(await latex(page)).toBe('');
  await press(page, 'basic-02', 0, 0, -50);
  expect(await latex(page)).toBe('x');
});

test('長押しで選ぶ: タップは中央、長押しで選択画面', async ({ page }) => {
  await setSettings(page, { guardMs: 0, mode: 'hold', holdMs: 400 });
  await press(page, 'basic-02');
  expect(await latex(page)).toBe('8');
  const box = (await key(page, 'basic-02').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('dialog.chooser')).toBeVisible();
  await page.mouse.up();
  await page.locator('dialog.chooser').getByRole('button', { name: '左 t' }).click();
  expect(await latex(page)).toBe('8t');
});

test('選択画面の候補は44px以上', async ({ page }) => {
  await setSettings(page, { mode: 'tap', keyHeight: 56 });
  await key(page, 'basic-02').focus();
  await page.keyboard.press('Enter');
  for (const o of await page.locator('dialog.chooser .opt').all()) {
    const b = (await o.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
});
