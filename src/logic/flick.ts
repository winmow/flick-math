import type { Dir, Key, KeyItem } from './types';

export const DIRS: Dir[] = ['c', 'u', 'r', 'd', 'l'];

export const DIR_NAMES: Record<Dir, string> = { c: '中央', u: '上', r: '右', d: '下', l: '左' };

/** 押した位置からの移動量(dx, dy: 画面座標、下が+)で方向を決める。 */
export function dirFrom(dx: number, dy: number, threshold: number): Dir {
  if (Math.hypot(dx, dy) < threshold) return 'c';
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'r' : 'l';
  return dy < 0 ? 'u' : 'd';
}

export function hasAnyItem(key: Key): boolean {
  return DIRS.some((d) => key[d]);
}

/**
 * 方向に対応する候補を返す。中央に候補がないキーは、試作と同じく最初にある候補で代用する。
 * 上下左右で候補がない方向は null（何も入力しない）。
 */
export function itemFor(key: Key, dir: Dir): KeyItem | null {
  if (dir !== 'c') return key[dir] ?? null;
  return key.c ?? key.u ?? key.r ?? key.d ?? key.l ?? null;
}

/** 候補の読み上げ名。読み替え(speak)があっても、画面の表示名を含める（WCAG 2.5.3 名前にラベルを含める） */
export function itemName(item: KeyItem): string {
  return item.speak && item.speak !== item.label ? `${item.speak}（${item.label}）` : item.label;
}

/** キーのアクセシブルネーム（全方向の候補を含める） */
export function keyAccessibleName(key: Key): string {
  if (!hasAnyItem(key)) return '空きキー';
  return DIRS.filter((d) => key[d])
    .map((d) => `${DIR_NAMES[d]} ${itemName(key[d]!)}`)
    .join('、');
}
