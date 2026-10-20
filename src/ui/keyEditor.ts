import { convertLatexToMarkup, validateLatex } from 'mathlive';
import { braceProblem } from '../logic/latexCheck';
import { DIRS, DIR_NAMES } from '../logic/flick';
import type { Dir, Key, KeyItem } from '../logic/types';

export interface KeyEditorOptions {
  key: Key;
  title: string; // 例「基本タブ 3番目のキー」
  canReset: boolean; // 初期状態へ戻せる（初期キー、または追加タブ内のキー）
  library: KeyItem[]; // 「よく使う記号から選ぶ」の候補
  onSave(body: Omit<Key, 'id'>): void;
  onReset(): void;
  onMove(delta: -1 | 1): boolean;
  announce(text: string): void;
}

/** プレビュー用：#0 と #? を空欄の表示にする */
export function previewLatex(latex: string): string {
  return latex.replace(/#[0?]/g, '\\placeholder{}');
}

/** 入力中のLaTeXの誤り。なければ null */
export function latexProblem(latex: string): string | null {
  if (!latex.trim()) return null;
  const brace = braceProblem(latex);
  if (brace) return `LaTeXに誤りがあります：${brace}`;
  // 改行 \\ は、場合分けや行列の中で使うもの。単体では未知の命令とされるので検査から外す
  const errs = validateLatex(previewLatex(latex).replaceAll('\\\\', ' '));
  return errs.length ? 'LaTeXに誤りがあります。かっこの対応や命令名を確かめてください' : null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

let seq = 0;

export function openKeyEditor(dialog: HTMLDialogElement, picker: HTMLDialogElement, o: KeyEditorOptions) {
  dialog.replaceChildren();
  dialog.setAttribute('aria-labelledby', 'ke-title');
  const head = el('div', { class: 'dhead' });
  head.append(el('h2', { id: 'ke-title' }, 'キーを編集'));
  head.append(el('p', { class: 'note' }, o.title));
  dialog.append(head);

  const rows: Partial<Record<Dir, { label: HTMLInputElement; latex: HTMLInputElement }>> = {};
  const form = el('div', { class: 'edit-rows' });

  for (const d of DIRS) {
    const item = o.key[d];
    const id = `ke-${seq++}`;
    const row = el('fieldset', { class: 'edit-row' });
    row.append(el('legend', {}, DIR_NAMES[d]));
    const label = el('input', { id: `${id}-l`, type: 'text', autocomplete: 'off', 'aria-label': `${DIR_NAMES[d]}の表示名` }) as HTMLInputElement;
    const latex = el('input', { id: `${id}-x`, type: 'text', autocomplete: 'off', spellcheck: 'false', class: 'code', 'aria-label': `${DIR_NAMES[d]}のLaTeX` }) as HTMLInputElement;
    label.placeholder = '表示名';
    latex.placeholder = 'LaTeX（#0 = カーソル位置、#? = 空欄）';
    label.value = item?.label ?? '';
    latex.value = item?.latex ?? '';
    const preview = el('div', { class: 'preview', 'aria-hidden': 'true' });
    const problem = el('p', { class: 'problem', role: 'alert' });
    const refresh = () => {
      preview.innerHTML = latex.value.trim() ? convertLatexToMarkup(previewLatex(latex.value)) : '';
      problem.textContent = latexProblem(latex.value) ?? '';
    };
    latex.addEventListener('input', refresh);
    refresh();

    const pick = el('button', { type: 'button', class: 'act small' }, 'よく使う記号から選ぶ');
    pick.addEventListener('click', () =>
      openPicker(picker, o.library, (it) => {
        label.value = it.label;
        latex.value = it.latex;
        refresh();
        o.announce(`${DIR_NAMES[d]}に ${it.label} を入れました`);
        label.focus();
      }),
    );
    const clear = el('button', { type: 'button', class: 'act small' }, `${DIR_NAMES[d]}を空にする`);
    clear.addEventListener('click', () => {
      label.value = '';
      latex.value = '';
      refresh();
    });
    const btns = el('div', { class: 'btns' });
    btns.append(pick, clear);
    row.append(label, latex, preview, problem, btns);
    rows[d] = { label, latex };
    form.append(row);
  }
  dialog.append(form);

  const msg = el('p', { class: 'problem', role: 'alert' });
  dialog.append(msg);

  const move = el('div', { class: 'btns' });
  for (const [text, delta] of [['前へ', -1], ['後ろへ', 1]] as const) {
    const b = el('button', { type: 'button', class: 'act' }, `キーの位置を${text}`);
    b.addEventListener('click', () => o.announce(o.onMove(delta) ? `位置を${text}動かしました` : 'これ以上動かせません'));
    move.append(b);
  }
  if (o.canReset) {
    const reset = el('button', { type: 'button', class: 'act' }, 'このキーを初期状態へ');
    reset.addEventListener('click', () => {
      o.onReset();
      dialog.close();
    });
    move.append(reset);
  }
  dialog.append(move);

  const foot = el('div', { class: 'drow' });
  const cancel = el('button', { type: 'button', class: 'act' }, 'やめる');
  cancel.addEventListener('click', () => dialog.close());
  const save = el('button', { type: 'button', class: 'act primary' }, '保存');
  save.addEventListener('click', () => {
    const body: Omit<Key, 'id'> = {};
    for (const d of DIRS) {
      const label = rows[d]!.label.value.trim();
      const latex = rows[d]!.latex.value.trim();
      if (!label && !latex) continue;
      if (!latex) return fail(`${DIR_NAMES[d]}：LaTeXを入れてください`, rows[d]!.latex);
      if (!label) return fail(`${DIR_NAMES[d]}：表示名を入れてください`, rows[d]!.label);
      const bad = latexProblem(latex);
      if (bad) return fail(`${DIR_NAMES[d]}：${bad}`, rows[d]!.latex);
      body[d] = { label, latex };
    }
    o.onSave(body);
    dialog.close();
  });
  function fail(text: string, field: HTMLElement) {
    msg.textContent = text;
    field.focus();
  }
  foot.append(cancel, save);
  dialog.append(foot);
  dialog.showModal();
}

function openPicker(picker: HTMLDialogElement, library: KeyItem[], choose: (i: KeyItem) => void) {
  picker.replaceChildren();
  picker.setAttribute('aria-labelledby', 'kp-title');
  picker.append(el('h2', { id: 'kp-title' }, 'よく使う記号から選ぶ'));
  const q = el('input', { type: 'search', autocomplete: 'off', 'aria-label': '記号を探す（表示名またはLaTeX）', class: 'search' }) as HTMLInputElement;
  q.placeholder = '探す（例：分数、sqrt）';
  const list = el('div', { class: 'picker-list' });
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    list.replaceChildren();
    const hits = library.filter((i) => !t || i.label.toLowerCase().includes(t) || i.latex.toLowerCase().includes(t)).slice(0, 80);
    if (!hits.length) list.append(el('p', { class: 'note' }, '見つかりませんでした'));
    for (const it of hits) {
      const b = el('button', { type: 'button', class: 'opt' });
      b.append(el('span', {}, it.label), el('small', {}, it.latex));
      b.addEventListener('click', () => {
        picker.close();
        choose(it);
      });
      list.append(b);
    }
  };
  q.addEventListener('input', draw);
  draw();
  const close = el('button', { type: 'button', class: 'act' }, 'やめる');
  close.addEventListener('click', () => picker.close());
  const foot = el('div', { class: 'drow' });
  foot.append(close);
  picker.append(q, list, foot);
  picker.showModal();
}
