import { describe, expect, it } from 'vitest';
import { allItems, parseKeySet } from '../src/logic/keyset';
import { defaultKeySet } from '../src/logic/defaultKeyset';

describe('keyset', () => {
  it('同梱のdefault.jsonを検証できる', () => {
    expect(defaultKeySet.tabs.map((t) => t.id)).toEqual(['basic', 'exam', 'uni', 'my']);
    expect(allItems(defaultKeySet).length).toBeGreaterThan(100);
  });
  it('壊れたデータを拒否する', () => {
    expect(() => parseKeySet({ version: 2, tabs: [] })).toThrow();
    expect(() => parseKeySet(null)).toThrow();
  });
  it('キーID重複を拒否する', () => {
    const t = { id: 't', name: 'T', level: 'custom', columns: 4, keys: [{ id: 'a' }, { id: 'a' }] };
    expect(() => parseKeySet({ version: 1, tabs: [t] })).toThrow();
  });
});
