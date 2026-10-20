import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const latex = (page: Page) => page.evaluate(() => (window as unknown as { __port: { getLatex(): string } }).__port.getLatex());
const setSettings = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((v) => Object.assign((window as unknown as { __settings: object }).__settings, v), s);
const key = (page: Page, id: string) => page.locator(`[data-key-id="${id}"]`);

async function flick(page: Page, id: string, dx: number, dy: number) {
  const box = (await key(page, id).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 });
  await page.mouse.move(x + dx, y + dy, { steps: 3 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  await setSettings(page, { guardMs: 0 }); // 既定の連続タッチ無視は、個別のテストで確認する
});

test('タップで中央、フリックで各方向が入る', async ({ page }) => {
  await flick(page, 'basic-01', 0, 0);
  expect(await latex(page)).toBe('7');
  await flick(page, 'basic-02', 0, -50); // 上: x
  await flick(page, 'basic-02', 50, 0); // 右: y
  await flick(page, 'basic-02', 0, 50); // 下: z
  await flick(page, 'basic-02', -50, 0); // 左: t
  expect(await latex(page)).toBe('7xyzt');
});

test('判定距離未満は中央になる', async ({ page }) => {
  await flick(page, 'basic-02', 0, -20);
  expect(await latex(page)).toBe('8');
});

test('指がキーの外まで動いても判定が続く', async ({ page }) => {
  await flick(page, 'basic-02', 300, 0);
  expect(await latex(page)).toBe('y');
});

test('空きキーは何も入力しない', async ({ page }) => {
  await page.getByRole('button', { name: 'マイキー' }).click();
  await page.locator('.key.empty').first().click();
  expect(await latex(page)).toBe('');
});

test('吹き出しが出て、離すと消える', async ({ page }) => {
  const box = (await key(page, 'basic-10').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 50, { steps: 4 });
  await expect(page.locator('#bubble')).toHaveText('分数');
  await page.mouse.up();
  await expect(page.locator('#bubble')).toBeHidden();
});

test('分数→1→次の空欄→2 をキー操作で入力できる', async ({ page }) => {
  await flick(page, 'basic-10', 0, -50); // 分数
  await flick(page, 'basic-09', 0, 0); // 1
  await page.locator('.actions').getByRole('button', { name: /次の空欄/ }).click();
  await flick(page, 'basic-10', 0, 0); // 2
  expect(await latex(page)).toMatch(/^\\frac(\{1\}\{2\}|12)$/);
});

test('選択した状態で √ を押すと選択部分が中に入る', async ({ page }) => {
  await page.evaluate(() => {
    const mf = document.querySelector('math-field') as HTMLElement & { value: string; executeCommand(c: string): void };
    mf.value = 'x+1';
    mf.focus();
    mf.executeCommand('selectAll');
  });
  await flick(page, 'basic-09', -50, 0); // 左: √
  expect(await latex(page)).toBe('\\sqrt{x+1}');
});

test('キーボード(Enter)では選択画面が開き、候補を選んで入力できる', async ({ page }) => {
  await key(page, 'basic-01').focus();
  await page.keyboard.press('Enter');
  await page.locator('dialog.chooser').getByRole('button', { name: /^\) 右$/ }).click();
  expect(await latex(page)).toBe(')');
});

test('タブ切替ができる', async ({ page }) => {
  await page.getByRole('button', { name: '入試' }).click();
  await expect(page.locator('[data-key-id="exam-01"]')).toBeVisible();
});

test('キーは44px以上、axe違反なし', async ({ page }) => {
  const box = (await key(page, 'basic-01').boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('⌫ キーが並びの最後にあり、タップで1つ消せる', async ({ page }) => {
  await flick(page, 'basic-01', 0, 0); // 7
  await flick(page, 'basic-02', 0, 0); // 8
  const bs = page.locator('.key.special');
  await expect(bs).toHaveCount(1);
  await expect(bs).toHaveAccessibleName('⌫ 消す');
  const last = await page.locator('.grid > *').last().getAttribute('data-special');
  expect(last).toBe('backspace');
  await bs.click();
  expect(await latex(page)).toBe('7');
  const box = (await bs.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('⌫ キーは連続タッチ無視の設定に従う', async ({ page }) => {
  await setSettings(page, { guardMs: 600 });
  await flick(page, 'basic-01', 0, 0);
  await page.waitForTimeout(650);
  await flick(page, 'basic-02', 0, 0); // 78
  await page.waitForTimeout(650);
  await page.locator('.key.special').click();
  await page.locator('.key.special').click(); // 二度押し：無視される
  expect(await latex(page)).toBe('7');
});

test('どのタブにも⌫キーがあり、編集モードでは消さない', async ({ page }) => {
  await page.getByRole('button', { name: '入試' }).click();
  await expect(page.locator('.key.special')).toHaveCount(1);
  await flick(page, 'exam-01', 0, 0);
  const before = await latex(page);
  await page.getByRole('button', { name: 'キーを編集' }).click();
  await page.locator('.key.special').click();
  expect(await latex(page)).toBe(before);
});
