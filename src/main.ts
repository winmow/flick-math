import { MathfieldElement } from 'mathlive';
import { registerSW } from 'virtual:pwa-register';
import 'mathlive/static.css';
import './styles.css';
import { defaultKeySet } from './logic/defaultKeyset';
import { runAction, type ActionId } from './logic/editor';
import { activeProfile } from './logic/profile';
import { loadState, saveState } from './logic/storage';
import { isDefaultKey, moveKey, moveKeyTo, resetKey, resolveTabs, setKey, visibleTabs, emptyCustomization } from './logic/customize';
import { mountCopy } from './ui/copy';
import { mountHelp } from './ui/help';
import { openKeyEditor } from './ui/keyEditor';
import { mountSettings } from './ui/settingsDialog';
import { applyAppSettings, feedback } from './ui/appSettings';
import { mountKeypad } from './ui/keypad';
import { DIRS } from './logic/flick';
import type { Key, KeyItem } from './logic/types';
import { mathfieldPort } from './ui/mathfieldPort';

// フォントは同梱（CDN不使用）。MathLive標準の仮想キーボードは使わない。
MathfieldElement.fontsDirectory = `${import.meta.env.BASE_URL}fonts`;
MathfieldElement.soundsDirectory = null;

const BUTTONS: { id: ActionId; text: string }[] = [
  { id: 'left', text: '← 左へ' },
  { id: 'right', text: '右へ →' },
  { id: 'up', text: '↑ 上の欄' },
  { id: 'down', text: '↓ 下の欄' },
  { id: 'nextBlank', text: '次の空欄 ⇥' },
  { id: 'backspace', text: '1つ消す ⌫' },
  { id: 'undo', text: '取り消し ↶' },
  { id: 'redo', text: 'やり直し ↷' },
];

const app = document.getElementById('app')!;
app.innerHTML = `
<div class="wrap">
  <header class="top">
    <h1>フリック数式パッド</h1>
    <div class="btns">
      <button class="act" type="button" id="open-help">Wordで使う方法</button>
      <button class="act" type="button" id="open-settings">設定</button>
    </div>
  </header>
  <div class="main">
    <section class="out" aria-label="入力した数式">
      <div class="panel">
        <math-field id="mf" aria-label="数式" inputmode="none" virtualkeyboardmode="off"
          math-virtual-keyboard-policy="manual" smart-mode="false"></math-field>
      </div>
      <div class="actions" role="group" aria-label="編集操作">
        ${BUTTONS.map((b) => `<button class="act" type="button" data-action="${b.id}">${b.text}</button>`).join('')}
      </div>
      <div class="copy-row">
        <label for="fmt">コピーの形式</label>
        <select id="fmt"></select>
        <button class="act primary" type="button" id="copy">コピー</button>
      </div>
      <div id="copy-fallback" hidden>
        <textarea readonly rows="3" aria-label="コピー用のテキスト（選択済み）"></textarea>
        <p class="note">選択しました。Ctrl＋C（Macは⌘＋C）でコピーしてください。</p>
      </div>
      <p class="sr" id="live" aria-live="polite"></p>
    </section>
    <section class="pad" id="pad" aria-label="キーパッド"></section>
  </div>
</div>
<dialog class="settings" id="settings"></dialog>
<dialog class="settings" id="help"></dialog>
<dialog class="settings" id="key-editor"></dialog>
<dialog class="settings" id="key-picker"></dialog>`;

const mf = document.getElementById('mf') as MathfieldElement;
const live = document.getElementById('live')!;
const port = mathfieldPort(mf);

mf.mathVirtualKeyboardPolicy = 'manual';
mf.addEventListener('focusin', () => window.mathVirtualKeyboard?.hide());

// ボタンを押してもエディタのフォーカスとカーソル位置を失わせない
app.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => e.preventDefault());
  btn.addEventListener('click', () => {
    live.textContent = runAction(port, btn.dataset.action as ActionId);
    mf.focus();
  });
});

// ---- 設定とプロファイル ----
const state = loadState();
// 現在のプロファイルの設定を、キーパッドと共有するライブなオブジェクトとして持つ
const settings = { ...activeProfile(state).settings };

function persist() {
  activeProfile(state).settings = { ...settings };
  saveState(state);
}

const custom = () => activeProfile(state).custom;

function editKey(tabId: string, key: Key) {
  const tabs = resolveTabs(defaultKeySet, custom());
  const tab = tabs.find((t) => t.id === tabId)!;
  const library = new Map<string, KeyItem>();
  for (const t of tabs) for (const k of t.keys) for (const d of DIRS) if (k[d]) library.set(`${k[d]!.label}\u0000${k[d]!.latex}`, k[d]!);
  openKeyEditor(document.getElementById('key-editor') as HTMLDialogElement, document.getElementById('key-picker') as HTMLDialogElement, {
    key,
    title: `${tab.name}タブの ${tab.keys.findIndex((k) => k.id === key.id) + 1} 番目のキー`,
    canReset: true,
    library: [...library.values()],
    onSave: (body) => {
      setKey(custom(), key.id, body);
      customChanged();
      live.textContent = 'キーを保存しました';
    },
    onReset: () => {
      resetKey(defaultKeySet, custom(), key.id);
      customChanged();
      live.textContent = 'キーを初期状態に戻しました';
    },
    onMove: (delta) => {
      const ok = moveKey(defaultKeySet, custom(), tabId, key.id, delta);
      if (ok) customChanged();
      return ok;
    },
    announce: (t) => (live.textContent = t),
  });
}

function customChanged() {
  persist();
  keypad.refresh();
}

const keypad = mountKeypad(document.getElementById('pad')!, () => visibleTabs(defaultKeySet, custom()), settings, {
  onEditKey: editKey,
  onReorder: (tabId, keyId, targetId) => {
    if (moveKeyTo(defaultKeySet, custom(), tabId, keyId, targetId)) {
      customChanged();
      live.textContent = 'キーの位置を入れ替えました';
    }
  },
  onInsert: (item) => {
    port.insert(item.latex);
    feedback(settings);
    live.textContent = '';
    setTimeout(() => {
      const spoken = settings.speak ? `。現在の式：${mf.getValue('spoken-text')}` : '';
      live.textContent = `入力：${item.speak ?? item.label}${spoken}`;
    }, 30);
  },
  announce: (t) => (live.textContent = t),
});

function apply() {
  applyAppSettings(settings);
  keypad.applySettings();
}

const dlg = mountSettings(document.getElementById('settings') as HTMLDialogElement, {
  state,
  settings,
  onChange: () => {
    persist();
    apply();
  },
  onProfileSwitch: () => {
    saveState(state);
    apply();
    keypad.refresh();
  },
  base: defaultKeySet,
  getCustom: custom,
  resetCustom: () => {
    activeProfile(state).custom = emptyCustomization();
  },
  onCustomChange: customChanged,
  clearAll: () => port.clear(),
  announce: (t) => (live.textContent = t),
});
document.getElementById('open-settings')!.addEventListener('click', () => dlg.open());
const help = mountHelp(document.getElementById('help') as HTMLDialogElement);
document.getElementById('open-help')!.addEventListener('click', () => help.open());
mountCopy(
  {
    button: document.getElementById('copy') as HTMLButtonElement,
    select: document.getElementById('fmt') as HTMLSelectElement,
    fallback: document.getElementById('copy-fallback')!,
    announce: (t) => (live.textContent = t),
  },
  port,
  defaultKeySet,
  () => settings.copyFormat,
  (f) => {
    settings.copyFormat = f;
    persist();
  },
);
apply();

// テスト用に公開（E2E）
const w = window as unknown as { __port: typeof port; __settings: typeof settings };
w.__port = port;
w.__settings = settings;

// オフライン動作のためのService Worker（開発サーバーでは動かない）
if (import.meta.env.PROD) registerSW({ immediate: true });
