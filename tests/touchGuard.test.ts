import { describe, expect, it } from 'vitest';
import { isWithinGuard, judgeRelease } from '../src/logic/touchGuard';

describe('isWithinGuard', () => {
  it('入力がまだなければ無視しない', () => {
    expect(isWithinGuard(100, null, 150)).toBe(false);
  });
  it('無視時間内は無視、ちょうど経過後は受け付ける', () => {
    expect(isWithinGuard(1149, 1000, 150)).toBe(true);
    expect(isWithinGuard(1150, 1000, 150)).toBe(false);
  });
  it('0msなら常に受け付ける', () => {
    expect(isWithinGuard(1000, 1000, 0)).toBe(false);
  });
});

describe('judgeRelease', () => {
  it('最短押下時間未満は入力しない', () => {
    expect(judgeRelease(49, 50, 0)).toBe('tooShort');
    expect(judgeRelease(50, 50, 0)).toBe('accept');
    expect(judgeRelease(0, 0, 0)).toBe('accept');
  });
  it('押し続けて取り消し: オフなら長くても入力する', () => {
    expect(judgeRelease(10000, 0, 0)).toBe('accept');
  });
  it('押し続けて取り消し: 設定時間以上で取り消す', () => {
    expect(judgeRelease(1999, 0, 2000)).toBe('accept');
    expect(judgeRelease(2000, 0, 2000)).toBe('cancelled');
  });
});
