import { MathfieldElement } from 'mathlive';
import './styles.css';
import { defaultKeySet } from './logic/defaultKeyset';
import { runAction, type ActionId } from './logic/editor';
import { activeProfile } from './logic/profile';
import { loadState, saveState } from './logic/storage';
import { mountSettings } from './ui/settingsDialog';
import { applyAppSettings, feedback } from './ui/appSettings';
import { mountKeypad } from './ui/keypad';
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
    <button class="act" type="button" id="open-settings">設定</button>
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
      <p class="sr" id="live" aria-live="polite"></p>
    </section>
    <section class="pad" id="pad" aria-label="キーパッド"></section>
  </div>
</div>
<dialog class="settings" id="settings"></dialog>`;

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

const keypad = mountKeypad(document.getElementById('pad')!, defaultKeySet, settings, {
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
  },
  clearAll: () => port.clear(),
  announce: (t) => (live.textContent = t),
});
document.getElementById('open-settings')!.addEventListener('click', () => dlg.open());
apply();

// テスト用に公開（E2E）
const w = window as unknown as { __port: typeof port; __settings: typeof settings };
w.__port = port;
w.__settings = settings;
