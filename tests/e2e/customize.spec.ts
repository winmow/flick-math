import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const latex = (page: Page) => page.evaluate(() => (window as unknown as { __port: { getLatex(): string } }).__port.getLatex());
const key = (page: Page, id: string) => page.locator(`[data-key-id="${id}"]`);
const editor = (page: Page) => page.locator('#key-editor');
const settings = (page: Page) => page.locator('#settings');
const keyIds = (page: Page) => page.locator('.grid .key').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.keyId));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  await page.evaluate(() => Object.assign((window as unknown as { __settings: object }).__settings, { guardMs: 0 }));
});

async function startEdit(page: Page) {
  await page.getByRole('button', { name: 'キーを編集' }).click();
}

test('編集モードではキーを押しても入力されず、編集画面が開く', async ({ page }) => {
  await startEdit(page);
  await key(page, 'basic-01').click();
  await expect(editor(page)).toBeVisible();
  expect(await latex(page)).toBe('');
});

test('キーの内容を書き換えると、フリックで入力でき、リロード後も残る', async ({ page }) => {
  await startEdit(page);
  await key(page, 'basic-01').click();
  await editor(page).getByLabel('中央のLaTeX').fill('\\alpha ');
  await editor(page).getByLabel('中央の表示名').fill('ア');
  await editor(page).getByRole('button', { name: '保存' }).click();
  await expect(key(page, 'basic-01')).toContainText('ア');
  await page.getByRole('button', { name: 'キーを編集' }).click(); // 編集モード終了
  await key(page, 'basic-01').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(key(page, 'basic-01')).toContainText('ア');
});

test('LaTeXの誤りは保存できず、理由が出る', async ({ page }) => {
  await startEdit(page);
  await key(page, 'basic-01').click();
  await editor(page).getByLabel('右のLaTeX').fill('\\frac{1');
  await editor(page).getByLabel('右の表示名').fill('壊れ');
  await expect(editor(page).locator('fieldset', { has: page.getByLabel('右のLaTeX') }).locator('.problem')).toContainText('閉じられていません');
  await editor(page).getByRole('button', { name: '保存' }).click();
  await expect(editor(page)).toBeVisible();
  await expect(editor(page).locator('.problem').last()).toContainText('LaTeX');
});

test('表示名だけ・LaTeXだけでは保存できない', async ({ page }) => {
  await startEdit(page);
  await key(page, 'basic-01').click();
  await editor(page).getByLabel('上の表示名').fill('だけ');
  await editor(page).getByLabel('上のLaTeX').fill('');
  await editor(page).getByRole('button', { name: '保存' }).click();
  await expect(editor(page)).toBeVisible();
});

test('よく使う記号から選んで割り当てられる', async ({ page }) => {
  await startEdit(page);
  await key(page, 'basic-01').click();
  await editor(page).getByRole('button', { name: 'よく使う記号から選ぶ' }).first().click();
  await page.locator('#key-picker').getByLabel(/記号を探す/).fill('分数');
  await page.locator('#key-picker .opt').first().click();
  await expect(editor(page).getByLabel('中央の表示名')).toHaveValue('分数');
  await expect(editor(page).getByLabel('中央のLaTeX')).toHaveValue('\\frac{#0}{#?}');
});

test('「このキーを初期状態へ」で戻る', async ({ page }) => {
  await startEdit(page);
  await key(page, 'basic-01').click();
  await editor(page).getByLabel('中央の表示名').fill('ア');
  await editor(page).getByLabel('中央のLaTeX').fill('a');
  await editor(page).getByRole('button', { name: '保存' }).click();
  await key(page, 'basic-01').click();
  await editor(page).getByRole('button', { name: 'このキーを初期状態へ' }).click();
  await expect(key(page, 'basic-01').locator('.c')).toHaveText('7');
});

test('前へ／後ろへボタンで並べ替えできる', async ({ page }) => {
  await startEdit(page);
  await key(page, 'basic-02').click();
  await editor(page).getByRole('button', { name: 'キーの位置を前へ' }).click();
  await editor(page).getByRole('button', { name: 'やめる' }).click();
  expect((await keyIds(page)).slice(0, 2)).toEqual(['basic-02', 'basic-01']);
});

test('ドラッグでキーの位置を入れ替えられる', async ({ page }) => {
  await startEdit(page);
  const a = (await key(page, 'basic-01').boundingBox())!;
  const c = (await key(page, 'basic-03').boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(editor(page)).toBeHidden();
  expect((await keyIds(page)).slice(0, 3)).toEqual(['basic-02', 'basic-03', 'basic-01']);
});

test('タブ管理：名前変更・非表示・追加・削除', async ({ page }) => {
  await page.getByRole('button', { name: '設定' }).click();
  const name = settings(page).getByLabel('入試タブの名前');
  await name.fill('二次');
  await name.press('Tab');
  await settings(page).getByLabel('大学タブを表示').uncheck();
  await settings(page).getByLabel('追加するタブの名前').fill('理科');
  await settings(page).getByRole('button', { name: /タブを追加/ }).click();
  await settings(page).getByRole('button', { name: '閉じる' }).click();
  const tabs = page.locator('.tabs .tab');
  await expect(tabs).toHaveText(['基本', '二次', 'マイキー', '理科']);
  await tabs.nth(3).click();
  expect(await page.locator('.grid .key.empty').count()).toBe(16);

  await page.getByRole('button', { name: '設定' }).click();
  await settings(page).getByRole('button', { name: '理科タブを削除' }).click();
  await settings(page).getByRole('button', { name: /もう一度押すと「理科」を削除/ }).click();
  await settings(page).getByRole('button', { name: '閉じる' }).click();
  await expect(tabs).toHaveText(['基本', '二次', 'マイキー']);
});

test('タブの順番を入れ替えられ、初期タブには削除ボタンがない', async ({ page }) => {
  await page.getByRole('button', { name: '設定' }).click();
  await settings(page).getByRole('button', { name: '入試タブを後ろへ' }).click();
  await settings(page).getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('.tabs .tab')).toHaveText(['基本', '大学', '入試', 'マイキー']);
  await page.getByRole('button', { name: '設定' }).click();
  await expect(settings(page).getByRole('button', { name: '基本タブを削除' })).toHaveCount(0);
});

test('すべて初期状態へ(2回押し)で編集が消える', async ({ page }) => {
  await startEdit(page);
  await key(page, 'basic-01').click();
  await editor(page).getByLabel('中央の表示名').fill('ア');
  await editor(page).getByLabel('中央のLaTeX').fill('a');
  await editor(page).getByRole('button', { name: '保存' }).click();
  await page.getByRole('button', { name: '設定' }).click();
  await settings(page).getByRole('button', { name: 'キーとタブをすべて初期状態へ' }).click();
  await expect(key(page, 'basic-01').locator('.c')).toHaveText('ア');
  await settings(page).getByRole('button', { name: /編集内容がすべて消えます/ }).click();
  await settings(page).getByRole('button', { name: '閉じる' }).click();
  await expect(key(page, 'basic-01').locator('.c')).toHaveText('7');
});

test('プロファイルごとにキーの編集が別々になる', async ({ page }) => {
  await startEdit(page);
  await key(page, 'basic-01').click();
  await editor(page).getByLabel('中央の表示名').fill('ア');
  await editor(page).getByLabel('中央のLaTeX').fill('a');
  await editor(page).getByRole('button', { name: '保存' }).click();
  await page.getByRole('button', { name: '設定' }).click();
  await settings(page).getByRole('button', { name: '新しいプロファイルを追加' }).click();
  await settings(page).getByRole('button', { name: '閉じる' }).click();
  await expect(key(page, 'basic-01').locator('.c')).toHaveText('7');
});

test('編集画面・設定画面のaxe違反なし、ターゲット44px以上', async ({ page }) => {
  await startEdit(page);
  await key(page, 'basic-01').click();
  for (const e of await editor(page).locator('button, input').all()) {
    const b = (await e.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await editor(page).getByRole('button', { name: 'やめる' }).click();
  await page.getByRole('button', { name: '設定' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
