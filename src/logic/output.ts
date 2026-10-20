import type { KeyItem, KeySetFile } from './types';

export type OutputFormat = 'word' | 'latex' | 'mathml';

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  word: 'Word用（LaTeX）',
  latex: 'LaTeX（Overleaf・Teams等）',
  mathml: 'MathML',
};

/** MathLive が短縮して出す \frac12 や \sqrt2 を、波かっこつきに戻す（Word の LaTeX 変換は短縮形が苦手なため） */
export function expandShorthand(latex: string): string {
  const arg = String.raw`(\d|[a-zA-Z]|\\[a-zA-Z]+)`;
  return latex
    .replace(new RegExp(String.raw`\\(d?frac)\s*${arg}\s*${arg}`, 'g'), (_, f, a, b) => `\\${f}{${a}}{${b}}`)
    .replace(new RegExp(String.raw`\\(d?frac)\{([^{}]*)\}\s*${arg}(?![a-zA-Z])`, 'g'), (_, f, a, b) => `\\${f}{${a}}{${b}}`)
    .replace(new RegExp(String.raw`\\sqrt\s*${arg}(?![a-zA-Z])`, 'g'), (_, a) => `\\sqrt{${a}}`);
}

/**
 * 全キーのうち、Word では別の書き方が必要なもの（`word` を持つ項目）を集める。
 * 空欄 (#0, #?) を含まない項目だけが、完全一致の置き換えの対象。
 */
export function wordOverrides(ks: KeySetFile): [string, string][] {
  const out = new Map<string, string>();
  for (const t of ks.tabs)
    for (const k of t.keys)
      for (const d of ['c', 'u', 'r', 'd', 'l'] as const) {
        const it: KeyItem | undefined = k[d];
        if (it?.word && !/#[0?]/.test(it.latex)) out.set(it.latex.trim(), it.word.trim());
      }
  return [...out];
}

export function applyOverrides(latex: string, overrides: [string, string][]): string {
  // 長いものから置き換える（\le と \leq のような前方一致の取り違えを避ける）
  return [...overrides]
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((acc, [from, to]) => acc.split(from).join(to), latex);
}

/** MathLive が出した LaTeX を Word 向けにする */
export function toWordLatex(latex: string, overrides: [string, string][] = []): string {
  return expandShorthand(applyOverrides(latex, overrides)).trim();
}
