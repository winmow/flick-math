import { describe, expect, it } from 'vitest';
import { defaultKeySet } from '../src/logic/defaultKeyset';
import { allItems } from '../src/logic/keyset';
import { latexProblem } from '../src/ui/keyEditor';

describe('同梱キーセットのLaTeX', () => {
  it('すべてMathLiveで解析エラーにならない', () => {
    const bad: string[] = [];
    for (const { keyId, dir, item } of allItems(defaultKeySet)) {
      const problem = latexProblem(item.latex);
      if (problem) bad.push(`${keyId}.${dir} ${item.latex} → ${problem}`);
    }
    expect(bad).toEqual([]);
  });
});
