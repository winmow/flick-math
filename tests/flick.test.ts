import { describe, expect, it } from 'vitest';
import { dirFrom, itemFor, keyAccessibleName } from '../src/logic/flick';

describe('dirFrom', () => {
  it('判定距離未満は中央', () => {
    expect(dirFrom(0, 0, 30)).toBe('c');
    expect(dirFrom(29, 0, 30)).toBe('c');
    expect(dirFrom(20, 20, 30)).toBe('c'); // 28.28 < 30
  });
  it('判定距離ちょうどで方向が決まる', () => {
    expect(dirFrom(30, 0, 30)).toBe('r');
    expect(dirFrom(-30, 0, 30)).toBe('l');
    expect(dirFrom(0, -30, 30)).toBe('u');
    expect(dirFrom(0, 30, 30)).toBe('d');
  });
  it('斜めは大きいほうの軸、同値は縦', () => {
    expect(dirFrom(40, 20, 30)).toBe('r');
    expect(dirFrom(20, -40, 30)).toBe('u');
    expect(dirFrom(35, 35, 30)).toBe('d');
  });
  it('判定距離の設定値に従う', () => {
    expect(dirFrom(15, 0, 12)).toBe('r');
    expect(dirFrom(99, 0, 100)).toBe('c');
  });
});

describe('itemFor', () => {
  const key = { id: 'k', u: { label: '分数', latex: '\\frac{#?}{#?}' } };
  it('候補がない方向は null', () => {
    expect(itemFor(key, 'r')).toBeNull();
  });
  it('中央がなければ最初の候補で代用', () => {
    expect(itemFor(key, 'c')?.label).toBe('分数');
  });
  it('空きキーは何も返さない', () => {
    expect(itemFor({ id: 'e' }, 'c')).toBeNull();
    expect(keyAccessibleName({ id: 'e' })).toBe('空きキー');
  });
  it('アクセシブルネームに全方向を含める', () => {
    const k = { id: 'k', c: { label: '2', latex: '2' }, u: { label: '分数', latex: 'x', speak: 'ぶんすう' } };
    expect(keyAccessibleName(k)).toBe('中央 2、上 ぶんすう（分数）');
  });
});
