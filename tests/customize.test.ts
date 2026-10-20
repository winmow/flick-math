import { beforeEach, describe, expect, it } from 'vitest';
import { defaultKeySet } from '../src/logic/defaultKeyset';
import {
  addTab, deleteTab, emptyCustomization, moveKey, moveKeyTo, moveTab, renameTab, resetKey,
  resolveTabs, sanitizeCustomization, setKey, setTabHidden, visibleTabs, type Customization,
} from '../src/logic/customize';

let c: Customization;
beforeEach(() => (c = emptyCustomization()));
const base = defaultKeySet;
const tab = (id: string) => resolveTabs(base, c).find((t) => t.id === id)!;

describe('差分の適用', () => {
  it('何も変えなければ初期キーセットと同じ', () => {
    expect(resolveTabs(base, c)).toEqual(base.tabs);
  });
  it('変えたキーだけが差し替わり、他は初期のまま', () => {
    setKey(c, 'basic-01', { c: { label: 'A', latex: 'A' } });
    expect(tab('basic').keys[0]).toEqual({ id: 'basic-01', c: { label: 'A', latex: 'A' } }); // 方向は置き換え
    expect(tab('basic').keys[1]).toEqual(base.tabs[0].keys[1]);
  });
  it('初期状態へ戻せる', () => {
    setKey(c, 'basic-01', {});
    resetKey(base, c, 'basic-01');
    expect(tab('basic').keys[0]).toEqual(base.tabs[0].keys[0]);
  });
  it('初期キーセットが更新されても、未編集のキーは新しい内容になる', () => {
    setKey(c, 'basic-01', { c: { label: 'A', latex: 'A' } });
    const updated = structuredClone(base);
    updated.tabs[0].keys[1].c!.label = '新';
    const keys = resolveTabs(updated, c)[0].keys;
    expect(keys[0].c!.label).toBe('A');
    expect(keys[1].c!.label).toBe('新');
  });
});

describe('並べ替え', () => {
  it('前へ・後ろへ', () => {
    expect(moveKey(base, c, 'basic', 'basic-02', -1)).toBe(true);
    expect(tab('basic').keys.slice(0, 2).map((k) => k.id)).toEqual(['basic-02', 'basic-01']);
    expect(moveKey(base, c, 'basic', 'basic-02', -1)).toBe(false); // 先頭
  });
  it('端では動かない', () => {
    expect(moveKey(base, c, 'basic', 'basic-16', 1)).toBe(false);
  });
  it('指定キーの位置へ移す（ドラッグ）', () => {
    expect(moveKeyTo(base, c, 'basic', 'basic-01', 'basic-03')).toBe(true);
    expect(tab('basic').keys.slice(0, 3).map((k) => k.id)).toEqual(['basic-02', 'basic-03', 'basic-01']);
  });
  it('並べ替えたあとに初期キーセットへキーが増えても末尾に付く', () => {
    moveKey(base, c, 'basic', 'basic-02', -1);
    const updated = structuredClone(base);
    updated.tabs[0].keys.push({ id: 'basic-99' });
    const ids = resolveTabs(updated, c)[0].keys.map((k) => k.id);
    expect(ids[0]).toBe('basic-02');
    expect(ids.at(-1)).toBe('basic-99');
  });
});

describe('タブの管理', () => {
  it('名前変更・並べ替え・非表示', () => {
    renameTab(c, 'exam', '二次');
    expect(tab('exam').name).toBe('二次');
    renameTab(c, 'exam', '  ');
    expect(tab('exam').name).toBe('入試');
    moveTab(base, c, 'uni', -1);
    expect(resolveTabs(base, c).map((t) => t.id)).toEqual(['basic', 'uni', 'exam', 'my']);
    expect(setTabHidden(base, c, 'uni', true)).toBe(true);
    expect(visibleTabs(base, c).map((t) => t.id)).toEqual(['basic', 'exam', 'my']);
  });
  it('最後の表示タブは隠せない', () => {
    setTabHidden(base, c, 'exam', true);
    setTabHidden(base, c, 'uni', true);
    setTabHidden(base, c, 'my', true);
    expect(setTabHidden(base, c, 'basic', true)).toBe(false);
  });
  it('追加タブは空きキー16個で、中身を編集でき、削除できる', () => {
    const t = addTab(base, c, '自分用');
    expect(t.keys).toHaveLength(16);
    expect(tab(t.id).keys.every((k) => !k.c)).toBe(true);
    setKey(c, t.keys[0].id, { c: { label: 'x', latex: 'x' } });
    expect(tab(t.id).keys[0].c!.label).toBe('x');
    expect(deleteTab(base, c, t.id)).toBe(true);
    expect(resolveTabs(base, c).some((x) => x.id === t.id)).toBe(false);
    expect(c.keyEdits[t.keys[0].id]).toBeUndefined();
  });
  it('初期タブは削除できない', () => {
    expect(deleteTab(base, c, 'basic')).toBe(false);
  });
  it('追加タブのIDは重複しない', () => {
    const a = addTab(base, c, 'a');
    const b = addTab(base, c, 'b');
    deleteTab(base, c, a.id);
    const d = addTab(base, c, 'd');
    expect(new Set([b.id, d.id]).size).toBe(2);
  });
});

describe('sanitizeCustomization', () => {
  it('書き出し形式を往復できる', () => {
    setKey(c, 'basic-01', { c: { label: 'A', latex: 'A', speak: 'えー' } });
    moveKey(base, c, 'basic', 'basic-02', -1);
    addTab(base, c, '自分用');
    expect(sanitizeCustomization(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });
  it('未指定は空、壊れた形は拒否', () => {
    expect(sanitizeCustomization(undefined)).toEqual(emptyCustomization());
    expect(() => sanitizeCustomization({ keyEdits: { a: { c: { label: 1 } } } })).toThrow();
    expect(() => sanitizeCustomization({ hiddenTabs: 'x' })).toThrow();
    expect(() => sanitizeCustomization([])).toThrow();
  });
});
