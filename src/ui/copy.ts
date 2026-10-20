import type { EditorPort } from '../logic/editor';
import { FORMAT_LABELS, toWordLatex, wordOverrides, type OutputFormat } from '../logic/output';
import type { KeySetFile } from '../logic/types';

/** 指定形式のテキストを作る。数式が空なら空文字 */
export function buildOutput(port: EditorPort, format: OutputFormat, base: KeySetFile): string {
  if (!port.getLatex().trim()) return '';
  if (format === 'mathml') {
    const ml = port.getMathMl();
    return ml.trimStart().startsWith('<math') ? ml : `<math xmlns="http://www.w3.org/1998/Math/MathML">${ml}</math>`;
  }
  const latex = port.getLatexClean();
  return format === 'word' ? toWordLatex(latex, wordOverrides(base)) : latex;
}

export interface CopyUI {
  button: HTMLButtonElement;
  select: HTMLSelectElement;
  fallback: HTMLElement; // 中に textarea
  announce(text: string): void;
}

/** コピー操作を配線する。getFormat/setFormat で最後に選んだ形式を覚える */
export function mountCopy(ui: CopyUI, port: EditorPort, base: KeySetFile, getFormat: () => OutputFormat, setFormat: (f: OutputFormat) => void) {
  for (const [v, t] of Object.entries(FORMAT_LABELS)) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t;
    ui.select.append(o);
  }
  ui.select.value = getFormat();
  ui.select.addEventListener('change', () => setFormat(ui.select.value as OutputFormat));

  const area = ui.fallback.querySelector('textarea')!;
  const idle = ui.button.textContent!;
  let timer = 0;

  ui.button.addEventListener('pointerdown', (e) => e.preventDefault()); // 数式のカーソル位置を保つ
  ui.button.addEventListener('click', async () => {
    const text = buildOutput(port, ui.select.value as OutputFormat, base);
    if (!text) return ui.announce('コピーする数式がありません');
    try {
      await navigator.clipboard.writeText(text);
      ui.fallback.hidden = true;
      ui.button.textContent = 'コピーしました';
      clearTimeout(timer);
      timer = window.setTimeout(() => (ui.button.textContent = idle), 1500);
      ui.announce('コピーしました');
    } catch {
      // クリップボードが使えない環境：テキストを選択状態にして、手動コピーを案内する
      area.value = text;
      ui.fallback.hidden = false;
      area.focus();
      area.select();
      ui.announce('自動でコピーできませんでした。選択しました。Ctrl＋Cでコピーしてください');
    }
  });
}
