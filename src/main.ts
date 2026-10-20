import { MathfieldElement } from 'mathlive';
import './styles.css';
import { defaultKeySet } from './logic/defaultKeyset';
import { runAction, type ActionId } from './logic/editor';
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
  <h1>フリック数式パッド</h1>
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
    <section aria-label="キーパッド"><p>タブ: ${defaultKeySet.tabs.map((t) => t.name).join('・')}（段階3で実装）</p></section>
  </div>
</div>`;

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

// テスト用に公開（E2E）
(window as unknown as { __port: typeof port }).__port = port;
