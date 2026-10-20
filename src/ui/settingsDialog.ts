import { addTab, deleteTab, isDefaultTab, moveTab, renameTab, resolveTabs, setTabHidden, type Customization } from '../logic/customize';
import type { KeySetFile } from '../logic/types';
import { ImportError, activeProfile, createProfile, exportProfile, importProfile, type ProfilesState } from '../logic/profile';
import { SETTING_RULES, defaultSettings, type Settings } from '../logic/settings';

export interface SettingsContext {
  state: ProfilesState;
  settings: Settings; // 現在のプロファイルの設定（ライブ。変更はここへ書く）
  onChange(): void; // 設定が変わった（保存・反映）
  onProfileSwitch(): void; // 別のプロファイルに切り替えた
  base: KeySetFile; // 初期キーセット
  getCustom(): Customization; // 現在のプロファイルのカスタマイズ（ライブ）
  resetCustom(): void; // キーとタブを初期状態へ
  onCustomChange(): void; // タブ・キーが変わった（保存・描き直し）
  clearAll(): void; // 数式をすべて消す
  announce(text: string): void;
}

type NumField = { kind: 'num'; key: keyof Settings; label: string; unit: string; step: number; scale?: number };
type SelField = { kind: 'sel'; key: keyof Settings; label: string; options: [string, string][] };
type BoolField = { kind: 'bool'; key: keyof Settings; label: string };
type Field = NumField | SelField | BoolField;

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: 'キーの大きさと並び',
    fields: [
      { kind: 'num', key: 'keyHeight', label: 'キーの高さ', unit: 'px', step: 4 },
      { kind: 'num', key: 'columns', label: '列数', unit: '列', step: 1 },
      { kind: 'num', key: 'gap', label: 'キーの間隔', unit: 'px', step: 2 },
      { kind: 'sel', key: 'oneHand', label: '片手寄せ', options: [['none', 'なし'], ['left', '左に寄せる'], ['right', '右に寄せる']] },
      { kind: 'bool', key: 'showCorners', label: '四隅の候補を表示する' },
    ],
  },
  {
    title: '操作方式',
    fields: [
      { kind: 'sel', key: 'mode', label: '操作方式', options: [['flick', 'フリック'], ['tap', 'タップして選ぶ'], ['hold', '長押しで選ぶ']] },
      { kind: 'num', key: 'flickDistance', label: 'フリック判定距離', unit: 'px', step: 2 },
      { kind: 'num', key: 'holdMs', label: '長押しと判定する時間（長押しで選ぶ方式）', unit: 'ms', step: 50 },
    ],
  },
  {
    title: '誤入力防止',
    fields: [
      { kind: 'num', key: 'guardMs', label: '連続タッチを無視する時間', unit: 'ms', step: 10 },
      { kind: 'num', key: 'minPressMs', label: '最短押下時間（これより短い接触は入力しない）', unit: 'ms', step: 10 },
    ],
  },
  {
    title: '表示とフィードバック',
    fields: [
      { kind: 'num', key: 'mathScale', label: '数式の文字の大きさ', unit: '%', step: 10 },
      { kind: 'sel', key: 'theme', label: '画面の配色', options: [['auto', '端末に合わせる'], ['light', 'ライト'], ['dark', 'ダーク'], ['contrast', '高コントラスト']] },
      { kind: 'bool', key: 'speak', label: '入力後に数式全体を読み上げ通知する' },
      { kind: 'bool', key: 'vibrate', label: '入力時に振動する（対応端末のみ）' },
      { kind: 'bool', key: 'click', label: '入力時にクリック音を鳴らす' },
    ],
  },
];

let uid = 0;

export function mountSettings(dialog: HTMLDialogElement, ctx: SettingsContext) {
  function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function numberRow(f: NumField) {
    const rule = SETTING_RULES[f.key] as { min: number; max: number };
    const id = `s-${uid++}`;
    const wrap = el('div', { class: 'row' });
    const label = el('label', { for: id }, f.label);
    const out = el('output', { for: id, class: 'val' });
    const input = el('input', { id, type: 'range', min: String(rule.min), max: String(rule.max), step: String(f.step) });
    const show = () => (out.textContent = `${ctx.settings[f.key]}${f.unit}`);
    input.value = String(ctx.settings[f.key]);
    show();
    input.addEventListener('input', () => {
      (ctx.settings[f.key] as number) = Number(input.value);
      show();
      ctx.onChange();
    });
    wrap.append(label, out, input);
    return wrap;
  }

  function holdCancelRow() {
    const wrap = el('div', { class: 'row' });
    const cbId = `s-${uid++}`;
    const rId = `s-${uid++}`;
    const cb = el('input', { id: cbId, type: 'checkbox' }) as HTMLInputElement;
    const cbLabel = el('label', { for: cbId, class: 'check' }, '押し続けて取り消し（この時間以上押し続けて離すと入力しない）');
    const out = el('output', { for: rId, class: 'val' });
    const range = el('input', { id: rId, type: 'range', min: '1000', max: '5000', step: '500', 'aria-label': '押し続けて取り消しの時間' }) as HTMLInputElement;
    const sync = () => {
      range.disabled = !cb.checked;
      out.textContent = cb.checked ? `${(Number(range.value) / 1000).toFixed(1)}秒` : 'オフ';
      ctx.settings.holdCancelMs = cb.checked ? Number(range.value) : 0;
      ctx.onChange();
    };
    cb.checked = ctx.settings.holdCancelMs > 0;
    range.value = String(ctx.settings.holdCancelMs || 2000);
    range.disabled = !cb.checked;
    out.textContent = cb.checked ? `${(ctx.settings.holdCancelMs / 1000).toFixed(1)}秒` : 'オフ';
    cb.addEventListener('change', sync);
    range.addEventListener('input', sync);
    wrap.append(cb, cbLabel, out, range);
    wrap.classList.add('with-check');
    return wrap;
  }

  function selectRow(f: SelField) {
    const id = `s-${uid++}`;
    const wrap = el('div', { class: 'row' });
    const sel = el('select', { id }) as HTMLSelectElement;
    for (const [v, t] of f.options) sel.append(el('option', { value: v }, t));
    sel.value = String(ctx.settings[f.key]);
    sel.addEventListener('change', () => {
      (ctx.settings[f.key] as string) = sel.value;
      ctx.onChange();
    });
    wrap.append(el('label', { for: id }, f.label), sel);
    return wrap;
  }

  function boolRow(f: BoolField) {
    const id = `s-${uid++}`;
    const wrap = el('div', { class: 'row with-check' });
    const cb = el('input', { id, type: 'checkbox' }) as HTMLInputElement;
    cb.checked = Boolean(ctx.settings[f.key]);
    cb.addEventListener('change', () => {
      (ctx.settings[f.key] as boolean) = cb.checked;
      ctx.onChange();
    });
    wrap.append(cb, el('label', { for: id, class: 'check' }, f.label));
    return wrap;
  }

  /** 2回押しで実行するボタン。1回目で文言が変わる（時間切れはなし。設定を開き直すと元に戻る） */
  function confirmButton(text: string, armedText: string, run: () => void) {
    const b = el('button', { type: 'button', class: 'act' }, text);
    let armed = false;
    let idleLabel: string | null = null;
    b.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        b.textContent = armedText;
        if (b.hasAttribute('aria-label')) {
          idleLabel = b.getAttribute('aria-label');
          b.setAttribute('aria-label', armedText);
        }
        ctx.announce(armedText);
        return;
      }
      armed = false;
      b.textContent = text;
      if (idleLabel) b.setAttribute('aria-label', idleLabel);
      run();
    });
    return b;
  }

  function profileSection() {
    const sec = el('section', { class: 'sec' });
    sec.append(el('h3', {}, 'プロファイル（学生ごとの設定）'));
    const selId = `s-${uid++}`;
    const nameId = `s-${uid++}`;

    const r1 = el('div', { class: 'row' });
    const sel = el('select', { id: selId }) as HTMLSelectElement;
    for (const p of ctx.state.profiles) {
      const o = el('option', { value: p.id });
      o.textContent = p.name;
      sel.append(o);
    }
    sel.value = ctx.state.activeId;
    sel.addEventListener('change', () => {
      ctx.state.activeId = sel.value;
      Object.assign(ctx.settings, activeProfile(ctx.state).settings);
      ctx.onProfileSwitch();
      render();
      ctx.announce(`プロファイル ${activeProfile(ctx.state).name} に切り替えました`);
    });
    r1.append(el('label', { for: selId }, '使うプロファイル'), sel);

    const r2 = el('div', { class: 'row' });
    const name = el('input', { id: nameId, type: 'text', autocomplete: 'off' }) as HTMLInputElement;
    name.value = activeProfile(ctx.state).name;
    name.addEventListener('change', () => {
      activeProfile(ctx.state).name = name.value.trim() || '名称なし';
      ctx.onChange();
      render();
    });
    r2.append(el('label', { for: nameId }, 'プロファイル名（実名でなくてかまいません。例：Aさん用）'), name);

    const btns = el('div', { class: 'btns' });
    const add = el('button', { type: 'button', class: 'act' }, '新しいプロファイルを追加');
    add.addEventListener('click', () => {
      const p = createProfile(`プロファイル${ctx.state.profiles.length + 1}`, defaultSettings);
      ctx.state.profiles.push(p);
      ctx.state.activeId = p.id;
      Object.assign(ctx.settings, p.settings);
      ctx.onProfileSwitch();
      render();
      ctx.announce('新しいプロファイルを追加しました');
    });
    const del = confirmButton('このプロファイルを削除', 'もう一度押すと削除します', () => {
      if (ctx.state.profiles.length <= 1) return ctx.announce('最後のプロファイルは削除できません');
      ctx.state.profiles = ctx.state.profiles.filter((p) => p.id !== ctx.state.activeId);
      ctx.state.activeId = ctx.state.profiles[0].id;
      Object.assign(ctx.settings, activeProfile(ctx.state).settings);
      ctx.onProfileSwitch();
      render();
      ctx.announce('プロファイルを削除しました');
    });
    if (ctx.state.profiles.length <= 1) (del as HTMLButtonElement).disabled = true;

    const exp = el('button', { type: 'button', class: 'act' }, 'ファイルに書き出す');
    exp.addEventListener('click', () => {
      ctx.onChange(); // 最新の設定をプロファイルへ反映
      const p = activeProfile(ctx.state);
      const url = URL.createObjectURL(new Blob([exportProfile(p)], { type: 'application/json' }));
      const a = el('a', { href: url, download: `flick-math-${p.name}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    const fileId = `s-${uid++}`;
    const file = el('input', { id: fileId, type: 'file', accept: 'application/json,.json', class: 'sr', 'aria-label': 'プロファイルのファイルを選ぶ', tabindex: '-1' }) as HTMLInputElement;
    const imp = el('button', { type: 'button', class: 'act' }, 'ファイルから読み込む');
    const msg = el('p', { role: 'status', class: 'note' });
    imp.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      try {
        const p = importProfile(await f.text());
        ctx.state.profiles.push(p);
        ctx.state.activeId = p.id;
        Object.assign(ctx.settings, p.settings);
        ctx.onProfileSwitch();
        render();
        ctx.announce(`プロファイル ${p.name} を読み込みました`);
      } catch (e) {
        msg.textContent = '読み込めませんでした。書き出したファイルをそのまま選んでください';
        if (!(e instanceof ImportError)) console.error(e);
      }
    });

    btns.append(add, del, exp, imp, file);
    sec.append(r1, r2, btns, msg);
    return sec;
  }

  /** タブの管理（名前・並び順・表示/非表示・追加・削除）。変更のたびに描き直し、操作した部品に戻る */
  function tabSection() {
    const sec = el('section', { class: 'sec' });
    sec.append(el('h3', {}, 'タブの管理'));
    const c = ctx.getCustom();
    const changed = (focusFid?: string) => {
      ctx.onCustomChange();
      render(focusFid);
    };
    for (const t of resolveTabs(ctx.base, c)) {
      const row = el('div', { class: 'tab-row' });
      const nameId = `s-${uid++}`;
      const name = el('input', { id: nameId, type: 'text', autocomplete: 'off', 'aria-label': `${t.name}タブの名前`, 'data-fid': `name-${t.id}` }) as HTMLInputElement;
      name.value = t.name;
      name.addEventListener('change', () => {
        renameTab(c, t.id, name.value);
        changed(`name-${t.id}`);
      });
      const showId = `s-${uid++}`;
      const show = el('input', { id: showId, type: 'checkbox', 'aria-label': `${t.name}タブを表示`, 'data-fid': `show-${t.id}` }) as HTMLInputElement;
      show.checked = !c.hiddenTabs.includes(t.id);
      show.addEventListener('change', () => {
        if (!setTabHidden(ctx.base, c, t.id, !show.checked)) ctx.announce('最後の1つのタブは隠せません');
        changed(`show-${t.id}`);
      });
      const showLabel = el('label', { for: showId, class: 'check' }, '表示');
      const up = el('button', { type: 'button', class: 'act small', 'aria-label': `${t.name}タブを前へ`, 'data-fid': `up-${t.id}` }, '↑');
      up.addEventListener('click', () => {
        moveTab(ctx.base, c, t.id, -1);
        changed(`up-${t.id}`);
      });
      const down = el('button', { type: 'button', class: 'act small', 'aria-label': `${t.name}タブを後ろへ`, 'data-fid': `down-${t.id}` }, '↓');
      down.addEventListener('click', () => {
        moveTab(ctx.base, c, t.id, 1);
        changed(`down-${t.id}`);
      });
      row.append(name, show, showLabel, up, down);
      if (!isDefaultTab(ctx.base, t.id)) {
        const del = confirmButton('削除', `もう一度押すと「${t.name}」を削除`, () => {
          if (!deleteTab(ctx.base, c, t.id)) ctx.announce('このタブは削除できません');
          changed();
        });
        del.setAttribute('aria-label', `${t.name}タブを削除`);
        row.append(del);
      }
      sec.append(row);
    }
    const addId = `s-${uid++}`;
    const addRow = el('div', { class: 'row' });
    const addName = el('input', { id: addId, type: 'text', autocomplete: 'off' }) as HTMLInputElement;
    addName.placeholder = '例：理科';
    const add = el('button', { type: 'button', class: 'act' }, 'タブを追加（空きキー16個）');
    add.addEventListener('click', () => {
      const t = addTab(ctx.base, c, addName.value);
      ctx.announce(`タブ ${t.name} を追加しました。キーを編集で登録できます`);
      changed();
    });
    addRow.append(el('label', { for: addId }, '追加するタブの名前'), addName);
    sec.append(addRow, add);
    sec.append(
      confirmButton('キーとタブをすべて初期状態へ', 'もう一度押すと、編集内容がすべて消えます', () => {
        ctx.resetCustom();
        ctx.announce('キーとタブを初期状態に戻しました');
        changed();
      }),
    );
    return sec;
  }

  function render(focusFid?: string) {
    uid = 0;
    const top = dialog.scrollTop;
    dialog.replaceChildren();
    const h = el('div', { class: 'dhead' });
    h.append(el('h2', { id: 'settings-title' }, '設定'));
    const close = el('button', { type: 'button', class: 'act', 'data-close': '' }, '閉じる');
    close.addEventListener('click', () => dialog.close());
    h.append(close);
    dialog.append(h);
    dialog.append(profileSection());

    for (const s of SECTIONS) {
      const sec = el('section', { class: 'sec' });
      sec.append(el('h3', {}, s.title));
      for (const f of s.fields) {
        sec.append(f.kind === 'num' ? numberRow(f) : f.kind === 'sel' ? selectRow(f) : boolRow(f));
        if (f.kind === 'num' && f.key === 'minPressMs') sec.append(holdCancelRow());
      }
      dialog.append(sec);
    }

    dialog.append(tabSection());

    const sec = el('section', { class: 'sec' });
    sec.append(el('h3', {}, '数式を消す'));
    sec.append(
      confirmButton('数式をすべて消す', 'もう一度押すと消えます', () => {
        ctx.clearAll();
        ctx.announce('数式をすべて消しました。取り消しで戻せます');
      }),
    );
    dialog.append(sec);
    dialog.scrollTop = top;
    if (focusFid) dialog.querySelector<HTMLElement>(`[data-fid="${focusFid}"]`)?.focus();
  }

  dialog.setAttribute('aria-labelledby', 'settings-title');
  render();
  return { open: () => (render(), dialog.showModal()) };
}
