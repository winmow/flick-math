import type { Dir, KeySetFile, Tab } from './types';

const DIRS: Dir[] = ['c', 'u', 'r', 'd', 'l'];
const LEVELS = ['common', 'exam', 'university', 'custom'];

/** キーセットJSONの形を検証する。不正なら理由つきでthrowする。 */
export function parseKeySet(data: unknown): KeySetFile {
  const d = data as { version?: unknown; tabs?: unknown };
  if (!d || d.version !== 1 || !Array.isArray(d.tabs)) throw new Error('キーセットの形式が正しくありません');
  const ids = new Set<string>();
  for (const tab of d.tabs as Tab[]) {
    if (typeof tab.id !== 'string' || typeof tab.name !== 'string' || !LEVELS.includes(tab.level)) {
      throw new Error(`タブの定義が正しくありません: ${String(tab?.id)}`);
    }
    if (!Number.isInteger(tab.columns) || tab.columns < 1 || !Array.isArray(tab.keys)) {
      throw new Error(`タブの列数またはキーが正しくありません: ${tab.id}`);
    }
    for (const key of tab.keys) {
      if (typeof key.id !== 'string' || ids.has(key.id)) throw new Error(`キーIDが不正または重複しています: ${String(key.id)}`);
      ids.add(key.id);
      for (const dir of DIRS) {
        const item = key[dir];
        if (item && (typeof item.label !== 'string' || typeof item.latex !== 'string')) {
          throw new Error(`候補の定義が正しくありません: ${key.id}.${dir}`);
        }
      }
    }
  }
  return data as KeySetFile;
}

/** 全キーの全候補を {keyId, dir, latex} で平らにする（テスト・互換ページ用） */
export function allItems(ks: KeySetFile) {
  return ks.tabs.flatMap((t) =>
    t.keys.flatMap((k) => DIRS.filter((d) => k[d]).map((d) => ({ keyId: k.id, dir: d, item: k[d]! }))),
  );
}
