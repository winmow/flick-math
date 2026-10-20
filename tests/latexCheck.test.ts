import { describe, expect, it } from 'vitest';
import { braceProblem } from '../src/logic/latexCheck';
import { allItems } from '../src/logic/keyset';
import { defaultKeySet } from '../src/logic/defaultKeyset';

describe('braceProblem', () => {
  it('対応が取れていれば問題なし', () => {
    expect(braceProblem('\\frac{1}{2}')).toBeNull();
    expect(braceProblem('\\{x\\}')).toBeNull(); // 文字としての波かっこ
    expect(braceProblem('')).toBeNull();
  });
  it('足りない・多いを見つける', () => {
    expect(braceProblem('\\frac{1')).toMatch(/閉じられていません/);
    expect(braceProblem('a}')).toMatch(/多すぎ/);
    expect(braceProblem('}{')).toMatch(/多すぎ/);
  });
  it('同梱キーセットのLaTeXは、すべて波かっこの対応が取れている', () => {
    for (const { keyId, dir, item } of allItems(defaultKeySet)) {
      expect(braceProblem(item.latex), `${keyId}.${dir} ${item.latex}`).toBeNull();
    }
  });
});
