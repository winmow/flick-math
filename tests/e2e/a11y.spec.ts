import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const THEMES = ['light', 'dark', 'contrast'] as const;
const axe = (page: Page) => new AxeBuilder({ page }).withTags(TAGS).analyze();

async function setTheme(page: Page, theme: string) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
}

const screens: Record<string, (page: Page) => Promise<void>> = {
  メイン: async () => {},
  設定: async (page) => {
    await page.getByRole('button', { name: '設定' }).click();
  },
  Wordで使う方法: async (page) => {
    await page.getByRole('button', { name: 'Wordで使う方法' }).click();
  },
  キー編集: async (page) => {
    await page.getByRole('button', { name: 'キーを編集' }).click();
    await page.locator('[data-key-id="basic-02"]').click();
  },
  記号の選択: async (page) => {
    await page.getByRole('button', { name: 'キーを編集' }).click();
    await page.locator('[data-key-id="basic-02"]').click();
    await page.getByRole('button', { name: 'よく使う記号から選ぶ' }).first().click();
  },
  タップして選ぶ画面: async (page) => {
    await page.evaluate(() => Object.assign((window as unknown as { __settings: object }).__settings, { mode: 'tap' }));
    await page.locator('[data-key-id="basic-02"]').click();
  },
};

for (const theme of THEMES) {
  for (const [name, open] of Object.entries(screens)) {
    test(`axe(WCAG 2.2 AA): ${name} / ${theme}`, async ({ page }) => {
      await page.goto('/');
      await page.locator('.key').first().waitFor();
      await setTheme(page, theme);
      await open(page);
      const r = await axe(page);
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
    });
  }
}

test('axe: Word互換テストページ', async ({ page }) => {
  await page.goto('/dev/word-test.html');
  await page.locator('table.wt tbody tr').first().waitFor();
  const r = await axe(page);
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}件`)).toEqual([]);
});

test('320px幅・200%拡大相当でも横スクロールが出ない', async ({ page }) => {
  for (const w of [320, 640]) {
    await page.setViewportSize({ width: w, height: 700 });
    await page.goto('/');
    await page.locator('.key').first().waitFor();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `${w}px`).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: '設定' }).click();
    const overDlg = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overDlg, `設定 ${w}px`).toBeLessThanOrEqual(0);
    const dlgOver = await page.locator('#settings').evaluate((d) => d.scrollWidth - d.clientWidth);
    expect(dlgOver, `設定ダイアログ ${w}px`).toBeLessThanOrEqual(0);
  }
});

test('最小設定(キー56px・間隔4px・5列)でも、すべての操作対象が44px以上', async ({ page }) => {
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  await page.evaluate(() => {
    Object.assign((window as unknown as { __settings: object }).__settings, { keyHeight: 56, gap: 4, columns: 5 });
  });
  await page.getByRole('button', { name: '設定' }).click();
  await page.locator('#settings').getByLabel('キーの高さ').evaluate((el) => {
    (el as HTMLInputElement).value = '56';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#settings').getByLabel('列数').evaluate((el) => {
    (el as HTMLInputElement).value = '5';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#settings').getByLabel('キーの間隔').evaluate((el) => {
    (el as HTMLInputElement).value = '4';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#settings').getByRole('button', { name: '閉じる' }).click();
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, select, input:not([type=file]), [role=button]')]
      .filter((e) => e.offsetParent !== null && !e.closest('[hidden]') && !e.closest('dialog:not([open])') && !e.closest('math-field'))
      .map((e) => ({ n: (e.getAttribute('aria-label') ?? e.textContent ?? e.tagName).trim().slice(0, 20), r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
      .map(({ n, r }) => `${n} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);
});

test('フォーカス表示が3px以上の太さで出る', async ({ page }) => {
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  await page.keyboard.press('Tab');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  const w = await page.evaluate(() => {
    const e = document.activeElement as HTMLElement;
    const s = getComputedStyle(e);
    return { tag: e.tagName, width: parseFloat(s.outlineWidth), style: s.outlineStyle };
  });
  expect(w.style).not.toBe('none');
  expect(w.width).toBeGreaterThanOrEqual(3);
});

test('キーボードだけで、タブ移動→キー選択→候補選択→コピー操作まで行える', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  // Tabで基本キー(7)へ移動し、Enterで選択画面→矢印ではなくTab/Enterで候補を選ぶ
  await page.locator('[data-key-id="basic-02"]').focus();
  await page.keyboard.press('Enter');
  const chooser = page.locator('dialog.chooser');
  await expect(chooser).toBeVisible();
  // ダイアログ内にフォーカスが閉じ込められ、Escで閉じられる
  await expect(chooser.locator(':focus')).toHaveCount(1); // フォーカスが選択画面の中にある
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(chooser).toBeHidden();
  const latex = await page.evaluate(() => (window as unknown as { __port: { getLatex(): string } }).__port.getLatex());
  expect(latex).not.toBe('');
  // Escで閉じられる
  await page.locator('[data-key-id="basic-02"]').focus();
  await page.keyboard.press('Space');
  await expect(chooser).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(chooser).toBeHidden();
  // コピー
  await page.getByRole('button', { name: 'コピー', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'コピーしました' })).toBeVisible();
});

test('prefers-reduced-motion で動きが抑えられる', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  const t = await page.locator('.act').first().evaluate((e) => getComputedStyle(e).transitionDuration);
  expect(['0s', '0s, 0s']).toContain(t);
});

test('入力・タブ切替・移動の結果がaria-liveで通知される', async ({ page }) => {
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  const live = page.locator('#live');
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await page.evaluate(() => Object.assign((window as unknown as { __settings: object }).__settings, { guardMs: 0 }));
  await page.locator('[data-key-id="basic-01"]').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.getByRole('button', { name: '入試' }).click();
  await expect(live).toHaveText('入試のキーに切り替えました');
  await page.locator('.actions').getByRole('button', { name: /← 左へ/ }).click();
  await expect(live).toHaveText('左へ移動');
});

test('縦長の画面では、キーパッドが画面下に固定される', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  const r = await page.locator('#pad').boundingBox();
  expect(Math.round(r!.y + r!.height)).toBe(844);
  await page.evaluate(() => window.scrollTo(0, 120));
  const r2 = await page.locator('#pad').boundingBox();
  expect(Math.round(r2!.y + r2!.height)).toBe(844);
  // 数式欄は上に残る
  const mf = await page.locator('math-field').boundingBox();
  expect(mf!.y).toBeGreaterThanOrEqual(0);
});

test('ダイアログ内でTab移動しても、フォーカス中の部品が固定ヘッダーに隠れない', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 500 });
  await page.goto('/');
  await page.getByRole('button', { name: '設定' }).click();
  const head = page.locator('#settings .dhead');
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const hb = (await head.boundingBox())!;
    const fb = await page.evaluate(() => (document.activeElement as HTMLElement).getBoundingClientRect().top);
    expect(fb, `Tab ${i + 1}`).toBeGreaterThanOrEqual(hb.y + hb.height - 1);
  }
});

test('スマホ幅では「消す」などがキーパッドの中(画面下の固定部分)にあり、押せる', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  await page.locator('.key').first().waitFor();
  await page.evaluate(() => Object.assign((window as unknown as { __settings: object }).__settings, { guardMs: 0 }));
  const quick = page.locator('#pad .quick');
  await expect(quick).toBeVisible();
  const q = (await quick.boundingBox())!;
  expect(q.y + q.height).toBeLessThanOrEqual(700); // 最初の画面に収まっている
  await page.locator('[data-key-id="basic-01"]').click();
  await page.locator('[data-key-id="basic-04"]').click();
  await quick.getByRole('button', { name: '⌫ 消す' }).click();
  expect(await page.evaluate(() => (window as unknown as { __port: { getLatex(): string } }).__port.getLatex())).toBe('7');
  await quick.getByRole('button', { name: '↶ 戻す' }).click();
  expect(await page.evaluate(() => (window as unknown as { __port: { getLatex(): string } }).__port.getLatex())).toBe('7+');
  for (const b of await quick.getByRole('button').all()) {
    const r = (await b.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(44);
    expect(r.height).toBeGreaterThanOrEqual(44);
  }
});

test('広い画面でも、キーパッドの上に操作行(←→・次の空欄・消す・戻す)が出る', async ({ page }) => {
  await page.goto('/');
  const quick = page.locator('#pad .quick');
  await expect(quick).toBeVisible();
  await expect(quick.getByRole('button')).toHaveText(['←', '→', '次の空欄', '⌫ 消す', '↶ 戻す']);
  const q = (await quick.boundingBox())!;
  const k = (await page.locator('#pad .grid').boundingBox())!;
  expect(q.y + q.height).toBeLessThanOrEqual(k.y); // キー一覧の上にある
});
