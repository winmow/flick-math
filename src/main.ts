import 'mathlive';
import { MathfieldElement } from 'mathlive';
import { defaultKeySet } from './logic/defaultKeyset';

// フォントは同梱（CDN不使用）
MathfieldElement.fontsDirectory = `${import.meta.env.BASE_URL}fonts`;

const app = document.getElementById('app')!;
app.innerHTML = `<h1>フリック数式パッド</h1>
<math-field id="mf" inputmode="none" math-virtual-keyboard-policy="manual"></math-field>
<p>読み込んだタブ: ${defaultKeySet.tabs.map((t) => t.name).join('・')}</p>`;
