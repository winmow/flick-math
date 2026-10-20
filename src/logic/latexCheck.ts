/** { } の対応を調べる。\{ \} は文字なので数えない。問題があれば理由を返す */
export function braceProblem(latex: string): string | null {
  let depth = 0;
  for (let i = 0; i < latex.length; i++) {
    const ch = latex[i];
    if (ch === '\\') {
      i++; // 次の1文字は命令名または記号
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth < 0) return '閉じ中かっこ } が多すぎます';
  }
  return depth > 0 ? '中かっこ { が閉じられていません' : null;
}
