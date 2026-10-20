import { describe, expect, it } from 'vitest';
import { defaultSettings, sanitizeSettings } from '../src/logic/settings';
import { addTab, setKey } from '../src/logic/customize';
import { defaultKeySet } from '../src/logic/defaultKeyset';
import { createProfile, exportProfile, importProfile, ImportError, parseState, initialState } from '../src/logic/profile';

describe('sanitizeSettings', () => {
  it('欠けた項目は既定値、知らない項目は捨てる', () => {
    const s = sanitizeSettings({ keyHeight: 100, bogus: 1 });
    expect(s).toEqual({ ...defaultSettings, keyHeight: 100 });
  });
  it('範囲外は丸める', () => {
    expect(sanitizeSettings({ keyHeight: 999 }).keyHeight).toBe(160);
    expect(sanitizeSettings({ flickDistance: 1 }).flickDistance).toBe(12);
    expect(sanitizeSettings({ holdCancelMs: 0 }).holdCancelMs).toBe(0);
    expect(sanitizeSettings({ holdCancelMs: 500 }).holdCancelMs).toBe(1000);
  });
  it('型が違えば拒否', () => {
    expect(() => sanitizeSettings({ keyHeight: '84' })).toThrow();
    expect(() => sanitizeSettings({ mode: 'swipe' })).toThrow();
    expect(() => sanitizeSettings({ speak: 1 })).toThrow();
    expect(() => sanitizeSettings(null)).toThrow();
  });
});

describe('profile 書き出し/読み込み', () => {
  it('書き出して読み込むと元に戻る', () => {
    const p = createProfile('Aさん用', { ...defaultSettings, keyHeight: 120, mode: 'tap', oneHand: 'left' });
    const q = importProfile(exportProfile(p));
    expect(q.name).toBe('Aさん用');
    expect(q.settings).toEqual(p.settings);
    expect(q.id).not.toBe(p.id); // 読み込みは新しいプロファイルとして追加される
  });
  it('カスタマイズ(キー編集・追加タブ)も一緒に往復する', () => {
    const p = createProfile('B');
    setKey(p.custom, 'basic-01', { c: { label: 'Z', latex: 'Z' } });
    addTab(defaultKeySet, p.custom, '自分用');
    const q = importProfile(exportProfile(p));
    expect(q.custom).toEqual(p.custom);
  });
  it('customが無い古いファイルは空のカスタマイズで読める', () => {
    const f = JSON.parse(exportProfile(createProfile('x')));
    delete f.custom;
    expect(importProfile(JSON.stringify(f)).custom.keyEdits).toEqual({});
  });
  it('壊れたファイルを拒否する', () => {
    for (const bad of ['', '{', '[]', '{"app":"other","version":1}', '{"app":"flick-math-profile","version":1,"name":"x","settings":{"keyHeight":"a"}}']) {
      expect(() => importProfile(bad)).toThrow(ImportError);
    }
  });
  it('新しいバージョンは拒否する', () => {
    const f = JSON.parse(exportProfile(createProfile('x')));
    f.version = 99;
    expect(() => importProfile(JSON.stringify(f))).toThrow(/新しい/);
  });
});

describe('parseState', () => {
  it('壊れた保存データは null', () => {
    expect(parseState(null)).toBeNull();
    expect(parseState({ version: 1, profiles: [] })).toBeNull();
    expect(parseState({ version: 1, profiles: [{ id: 'a', name: 'a', settings: { keyHeight: 'x' } }] })).toBeNull();
  });
  it('正しいデータは読め、存在しない activeId は先頭に戻す', () => {
    const s = initialState();
    const r = parseState({ ...s, activeId: 'none' })!;
    expect(r.activeId).toBe(s.profiles[0].id);
  });
});
