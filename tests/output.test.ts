import { describe, expect, it } from 'vitest';
import { applyOverrides, expandShorthand, toWordLatex, wordOverrides } from '../src/logic/output';

describe('expandShorthand', () => {
  it('\\frac12 を \\frac{1}{2} にする', () => {
    expect(expandShorthand('\\frac12')).toBe('\\frac{1}{2}');
    expect(expandShorthand('\\frac ab')).toBe('\\frac{a}{b}');
    expect(expandShorthand('\\dfrac12')).toBe('\\dfrac{1}{2}');
  });
  it('分子だけ波かっこの形も直す', () => {
    expect(expandShorthand('\\frac{x+1}2')).toBe('\\frac{x+1}{2}');
  });
  it('\\sqrt2 を \\sqrt{2} にする。\\sqrt{2} と \\sqrt[3]{x} はそのまま', () => {
    expect(expandShorthand('\\sqrt2')).toBe('\\sqrt{2}');
    expect(expandShorthand('\\sqrt{2}')).toBe('\\sqrt{2}');
    expect(expandShorthand('\\sqrt[3]{x}')).toBe('\\sqrt[3]{x}');
  });
  it('波かっこつきの形は変えない', () => {
    expect(expandShorthand('\\frac{1}{2}+\\frac{a}{b}')).toBe('\\frac{1}{2}+\\frac{a}{b}');
  });
});

describe('word オーバーライド', () => {
  const ks = {
    version: 1 as const,
    tabs: [
      {
        id: 't', name: 't', level: 'custom' as const, columns: 4,
        keys: [
          { id: 'k1', c: { label: 'R', latex: '\\mathbb{R}', word: '\\doubleR' } },
          { id: 'k2', c: { label: 'f', latex: '\\sqrt{#0}', word: 'X' } }, // 空欄つきは対象外
        ],
      },
    ],
  };
  it('空欄を含まない項目だけ集める', () => {
    expect(wordOverrides(ks)).toEqual([['\\mathbb{R}', '\\doubleR']]);
  });
  it('一致した箇所を置き換える', () => {
    expect(applyOverrides('x\\in\\mathbb{R}', wordOverrides(ks))).toBe('x\\in\\doubleR');
  });
  it('toWordLatex は置き換えと短縮展開の両方を行う', () => {
    expect(toWordLatex('\\frac12\\in\\mathbb{R}', wordOverrides(ks))).toBe('\\frac{1}{2}\\in\\doubleR');
  });
});
