import { MathfieldElement } from 'mathlive';
import 'mathlive/static.css';
import '../styles.css';
import { defaultKeySet } from '../logic/defaultKeyset';
import { DIRS, DIR_NAMES } from '../logic/flick';
import { buildOutput } from '../ui/copy';
import { previewLatex } from '../ui/keyEditor';
import { mathfieldPort } from '../ui/mathfieldPort';

/**
 * Word互換テストページ（SPEC §7.2）。本番のメニューからは開けない（URLを直接開く）。
 * 支援者が Word（Microsoft 365, Windows）で1つずつ貼り付けて変換し、結果を記録する。
 */
MathfieldElement.fontsDirectory = '../fonts'; // /dev/ の1つ上

const KEY = 'flick-math:word-compat';
type Result = { r: string; memo: string };
const RESULTS = ['未確認', 'OK', 'NG', '要修正'] as const;

let saved: Record<string, Result> = {};
try {
  saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
} catch {
  /* 記録が読めなければ空から */
}
const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* 保存できなくてもページは使える */
  }
};

const app = document.getElementById('app')!;
app.innerHTML = `<div class="wrap">
  <h1>Word互換テスト（開発用）</h1>
  <p class="note">手順：行の「Word用をコピー」→ Word で <code>Alt</code>＋<code>=</code> → 「変換」を LaTeX にして貼り付け →「すべて - 2次元形式」。結果を選んで、メモに気づきを書きます。記録はこのブラウザに残ります。</p>
  <div class="btns"><button class="act" type="button" id="export">結果をMarkdownの表にする</button></div>
  <textarea id="md" rows="6" readonly hidden aria-label="Markdownの表"></textarea>
  <math-field id="mf" style="position:absolute;left:-9999px;width:1px;height:1px" aria-hidden="true" tabindex="-1"></math-field>
  <table class="wt"><thead><tr><th>タブ</th><th>キー</th><th>方向</th><th>表示</th><th>Word用LaTeX</th><th>コピー</th><th>結果</th><th>メモ</th></tr></thead><tbody></tbody></table>
</div>`;

const mf = document.getElementById('mf') as MathfieldElement;
const port = mathfieldPort(mf);
const tbody = app.querySelector('tbody')!;
const rows: { id: string; tab: string; dir: string; label: string; word: string }[] = [];

function output(latex: string, format: 'word' | 'mathml') {
  mf.value = previewLatex(latex);
  return buildOutput(port, format, defaultKeySet);
}

async function copy(text: string, btn: HTMLButtonElement) {
  const idle = btn.textContent!;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'コピーしました';
  } catch {
    btn.textContent = 'コピーできません';
  }
  setTimeout(() => (btn.textContent = idle), 1200);
}

for (const tab of defaultKeySet.tabs) {
  for (const key of tab.keys) {
    for (const d of DIRS) {
      const item = key[d];
      if (!item) continue;
      const id = `${key.id}.${d}`;
      const word = output(item.latex, 'word');
      rows.push({ id, tab: tab.name, dir: DIR_NAMES[d], label: item.label, word });
      const tr = document.createElement('tr');
      const cell = (child: Node | string) => {
        const td = document.createElement('td');
        td.append(child);
        tr.append(td);
        return td;
      };
      cell(tab.name);
      cell(key.id);
      cell(DIR_NAMES[d]);
      cell(item.label);
      const code = document.createElement('code');
      code.textContent = word;
      cell(code);
      const bw = document.createElement('button');
      bw.type = 'button';
      bw.className = 'act small';
      bw.textContent = 'Word用をコピー';
      bw.setAttribute('aria-label', `${item.label}（${id}）のWord用をコピー`);
      bw.addEventListener('click', () => copy(word, bw));
      const bm = document.createElement('button');
      bm.type = 'button';
      bm.className = 'act small';
      bm.textContent = 'MathMLをコピー';
      bm.setAttribute('aria-label', `${item.label}（${id}）のMathMLをコピー`);
      bm.addEventListener('click', () => copy(output(item.latex, 'mathml'), bm));
      const box = document.createElement('div');
      box.className = 'btns';
      box.append(bw, bm);
      cell(box);
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', `${item.label}（${id}）の結果`);
      for (const r of RESULTS) sel.append(new Option(r, r));
      sel.value = saved[id]?.r ?? '未確認';
      const memo = document.createElement('input');
      memo.type = 'text';
      memo.setAttribute('aria-label', `${item.label}（${id}）のメモ`);
      memo.value = saved[id]?.memo ?? '';
      const save = () => {
        saved[id] = { r: sel.value, memo: memo.value };
        persist();
      };
      sel.addEventListener('change', save);
      memo.addEventListener('change', save);
      cell(sel);
      cell(memo);
      tbody.append(tr);
    }
  }
}

document.getElementById('export')!.addEventListener('click', () => {
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const lines = ['| タブ | キー | 方向 | 表示 | Word用LaTeX | 結果 | メモ |', '|---|---|---|---|---|---|---|'];
  for (const r of rows) {
    const s = saved[r.id] ?? { r: '未確認', memo: '' };
    lines.push(`| ${r.tab} | ${r.id} | ${r.dir} | ${esc(r.label)} | \`${esc(r.word)}\` | ${s.r} | ${esc(s.memo)} |`);
  }
  const md = document.getElementById('md') as HTMLTextAreaElement;
  md.value = lines.join('\n');
  md.hidden = false;
  md.focus();
  md.select();
});
