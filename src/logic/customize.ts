import { DIRS } from './flick';
import type { Dir, Key, KeyItem, KeySetFile, Tab } from './types';

/**
 * 利用者のカスタマイズ。初期キーセットとの「差分」だけを持つ（SPEC §6.1）。
 * アプリ更新で初期キーセットが改良されても、変えていないキーは新しいものになる。
 */
export interface Customization {
  /** キーの内容の上書き。値は5方向すべての置き換え（空のオブジェクト＝空きキー） */
  keyEdits: Record<string, Omit<Key, 'id'>>;
  /** タブごとのキーの並び（キーID）。載っていないキーは元の順で末尾に付く */
  keyOrder: Record<string, string[]>;
  /** タブの並び（タブID）。載っていないタブは元の順で末尾に付く */
  tabOrder: string[];
  hiddenTabs: string[];
  tabNames: Record<string, string>;
  /** 利用者が追加したタブ（キーは keyEdits で中身を持つ） */
  customTabs: Tab[];
}

export const CUSTOM_TAB_KEYS = 16;

export function emptyCustomization(): Customization {
  return { keyEdits: {}, keyOrder: {}, tabOrder: [], hiddenTabs: [], tabNames: {}, customTabs: [] };
}

const dirsOf = (k: Omit<Key, 'id'>): Partial<Record<Dir, KeyItem>> => {
  const o: Partial<Record<Dir, KeyItem>> = {};
  for (const d of DIRS) if (k[d]) o[d] = k[d];
  return o;
};

function orderBy<T>(items: T[], idOf: (t: T) => string, order: string[] | undefined): T[] {
  if (!order?.length) return items;
  const rank = new Map(order.map((id, i) => [id, i]));
  const known = items.filter((t) => rank.has(idOf(t))).sort((a, b) => rank.get(idOf(a))! - rank.get(idOf(b))!);
  return [...known, ...items.filter((t) => !rank.has(idOf(t)))];
}

/** 初期キーセット＋差分 → 実際に使うタブ（非表示のものも含む） */
export function resolveTabs(base: KeySetFile, c: Customization): Tab[] {
  const all = [...base.tabs, ...c.customTabs].map((t): Tab => {
    const keys = t.keys.map((k): Key => {
      const e = c.keyEdits[k.id];
      return e ? { id: k.id, ...dirsOf(e) } : k;
    });
    return { ...t, name: c.tabNames[t.id] ?? t.name, keys: orderBy(keys, (k) => k.id, c.keyOrder[t.id]) };
  });
  return orderBy(all, (t) => t.id, c.tabOrder);
}

export function visibleTabs(base: KeySetFile, c: Customization): Tab[] {
  return resolveTabs(base, c).filter((t) => !c.hiddenTabs.includes(t.id));
}

export const isDefaultKey = (base: KeySetFile, keyId: string) => base.tabs.some((t) => t.keys.some((k) => k.id === keyId));
export const isDefaultTab = (base: KeySetFile, tabId: string) => base.tabs.some((t) => t.id === tabId);

export function setKey(c: Customization, keyId: string, key: Omit<Key, 'id'>) {
  c.keyEdits[keyId] = dirsOf(key);
}

/** 初期状態へ。初期キーセットにないキー（追加タブ内）は空きキーに戻る */
export function resetKey(base: KeySetFile, c: Customization, keyId: string) {
  if (isDefaultKey(base, keyId)) delete c.keyEdits[keyId];
  else c.keyEdits[keyId] = {};
}

/** タブ内でキーを delta だけ動かす（-1 = 前へ, +1 = 後ろへ）。動かせたら true */
export function moveKey(base: KeySetFile, c: Customization, tabId: string, keyId: string, delta: number): boolean {
  const tab = resolveTabs(base, c).find((t) => t.id === tabId);
  if (!tab) return false;
  const ids = tab.keys.map((k) => k.id);
  const from = ids.indexOf(keyId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return false;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  c.keyOrder[tabId] = ids;
  return true;
}

/** ドラッグ用：キーを別のキーの位置へ移す */
export function moveKeyTo(base: KeySetFile, c: Customization, tabId: string, keyId: string, targetId: string): boolean {
  const tab = resolveTabs(base, c).find((t) => t.id === tabId);
  if (!tab) return false;
  const ids = tab.keys.map((k) => k.id);
  const from = ids.indexOf(keyId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return false;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  c.keyOrder[tabId] = ids;
  return true;
}

export function moveTab(base: KeySetFile, c: Customization, tabId: string, delta: number): boolean {
  const ids = resolveTabs(base, c).map((t) => t.id);
  const from = ids.indexOf(tabId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return false;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  c.tabOrder = ids;
  return true;
}

export function renameTab(c: Customization, tabId: string, name: string) {
  const n = name.trim();
  if (n) c.tabNames[tabId] = n;
  else delete c.tabNames[tabId];
}

/** 表示・非表示。最後の1つを隠すことはできない（false を返す） */
export function setTabHidden(base: KeySetFile, c: Customization, tabId: string, hidden: boolean): boolean {
  const hiddenNow = new Set(c.hiddenTabs);
  if (hidden) {
    if (visibleTabs(base, c).filter((t) => t.id !== tabId).length === 0) return false;
    hiddenNow.add(tabId);
  } else hiddenNow.delete(tabId);
  c.hiddenTabs = [...hiddenNow];
  return true;
}

/** 新しいタブを空きキー16個で作る。作ったタブのIDを返す */
export function addTab(base: KeySetFile, c: Customization, name: string, columns = 4): Tab {
  const used = new Set([...base.tabs, ...c.customTabs].map((t) => t.id));
  let n = c.customTabs.length + 1;
  while (used.has(`custom-${n}`)) n++;
  const id = `custom-${n}`;
  const tab: Tab = {
    id,
    name: name.trim() || `タブ${n}`,
    level: 'custom',
    columns,
    keys: Array.from({ length: CUSTOM_TAB_KEYS }, (_, i) => ({ id: `${id}-${String(i + 1).padStart(2, '0')}` })),
  };
  c.customTabs.push(tab);
  return tab;
}

/** 削除できるのは追加したタブだけ。初期タブは非表示のみ */
export function deleteTab(base: KeySetFile, c: Customization, tabId: string): boolean {
  if (isDefaultTab(base, tabId)) return false;
  const tab = c.customTabs.find((t) => t.id === tabId);
  if (!tab) return false;
  if (visibleTabs(base, c).filter((t) => t.id !== tabId).length === 0) return false;
  c.customTabs = c.customTabs.filter((t) => t.id !== tabId);
  for (const k of tab.keys) delete c.keyEdits[k.id];
  delete c.keyOrder[tabId];
  delete c.tabNames[tabId];
  c.tabOrder = c.tabOrder.filter((id) => id !== tabId);
  c.hiddenTabs = c.hiddenTabs.filter((id) => id !== tabId);
  return true;
}

// ---- 検証（読み込み時） ----

const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

function sanitizeItem(v: unknown, where: string): KeyItem {
  const o = v as Record<string, unknown>;
  if (!o || !isStr(o.label) || !isStr(o.latex)) throw new Error(`キーの候補が正しくありません: ${where}`);
  const item: KeyItem = { label: o.label, latex: o.latex };
  if (o.word !== undefined) {
    if (!isStr(o.word)) throw new Error(`キーの候補が正しくありません: ${where}`);
    item.word = o.word;
  }
  if (o.speak !== undefined) {
    if (!isStr(o.speak)) throw new Error(`キーの候補が正しくありません: ${where}`);
    item.speak = o.speak;
  }
  return item;
}

function sanitizeKeyBody(v: unknown, where: string): Omit<Key, 'id'> {
  if (typeof v !== 'object' || v === null) throw new Error(`キーの内容が正しくありません: ${where}`);
  const o = v as Record<string, unknown>;
  const out: Omit<Key, 'id'> = {};
  for (const d of DIRS) if (o[d] !== undefined) out[d] = sanitizeItem(o[d], `${where}.${d}`);
  return out;
}

export function sanitizeCustomization(raw: unknown): Customization {
  if (raw === undefined || raw === null) return emptyCustomization();
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('カスタマイズの形式が正しくありません');
  const r = raw as Record<string, unknown>;
  const c = emptyCustomization();
  if (r.keyEdits !== undefined) {
    if (typeof r.keyEdits !== 'object' || r.keyEdits === null) throw new Error('keyEdits が正しくありません');
    for (const [id, body] of Object.entries(r.keyEdits)) c.keyEdits[id] = sanitizeKeyBody(body, id);
  }
  if (r.keyOrder !== undefined) {
    if (typeof r.keyOrder !== 'object' || r.keyOrder === null) throw new Error('keyOrder が正しくありません');
    for (const [id, arr] of Object.entries(r.keyOrder)) {
      if (!isStrArr(arr)) throw new Error('keyOrder が正しくありません');
      c.keyOrder[id] = arr;
    }
  }
  if (r.tabOrder !== undefined) {
    if (!isStrArr(r.tabOrder)) throw new Error('tabOrder が正しくありません');
    c.tabOrder = r.tabOrder;
  }
  if (r.hiddenTabs !== undefined) {
    if (!isStrArr(r.hiddenTabs)) throw new Error('hiddenTabs が正しくありません');
    c.hiddenTabs = r.hiddenTabs;
  }
  if (r.tabNames !== undefined) {
    if (typeof r.tabNames !== 'object' || r.tabNames === null) throw new Error('tabNames が正しくありません');
    for (const [id, n] of Object.entries(r.tabNames)) {
      if (!isStr(n)) throw new Error('tabNames が正しくありません');
      c.tabNames[id] = n;
    }
  }
  if (r.customTabs !== undefined) {
    if (!Array.isArray(r.customTabs)) throw new Error('customTabs が正しくありません');
    for (const t of r.customTabs as Tab[]) {
      if (!t || !isStr(t.id) || !isStr(t.name) || !Array.isArray(t.keys) || !t.keys.every((k) => k && isStr(k.id))) {
        throw new Error('追加タブの形式が正しくありません');
      }
      c.customTabs.push({ id: t.id, name: t.name, level: 'custom', columns: Number.isInteger(t.columns) ? t.columns : 4, keys: t.keys.map((k) => ({ id: k.id })) });
    }
  }
  return c;
}
