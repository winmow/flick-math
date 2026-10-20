import { defaultSettings, sanitizeSettings, type Settings } from './settings';

/** プロファイル＝設定一式（段階6でカスタマイズしたキーセットの差分も加える） */
export interface Profile {
  id: string;
  name: string;
  settings: Settings;
}

export interface ProfilesState {
  version: 1;
  activeId: string;
  profiles: Profile[];
}

export const FILE_VERSION = 1;
const APP_ID = 'flick-math-profile';

export function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createProfile(name: string, settings: Settings = defaultSettings): Profile {
  return { id: newId(), name: name.trim() || '名称なし', settings: { ...settings } };
}

export function initialState(): ProfilesState {
  const p = createProfile('標準');
  return { version: 1, activeId: p.id, profiles: [p] };
}

/** 保存データの検証。壊れていれば null（呼び出し側で初期状態にする） */
export function parseState(raw: unknown): ProfilesState | null {
  try {
    const d = raw as Partial<ProfilesState>;
    if (!d || d.version !== 1 || !Array.isArray(d.profiles) || d.profiles.length === 0) return null;
    const profiles = d.profiles.map((p) => ({
      id: String(p.id),
      name: String(p.name),
      settings: sanitizeSettings(p.settings),
    }));
    const activeId = profiles.some((p) => p.id === d.activeId) ? (d.activeId as string) : profiles[0].id;
    return { version: 1, activeId, profiles };
  } catch {
    return null;
  }
}

export function activeProfile(s: ProfilesState): Profile {
  return s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0];
}

// ---- 書き出し・読み込み ----

export interface ProfileFile {
  app: typeof APP_ID;
  version: number;
  name: string;
  settings: Settings;
}

export function exportProfile(p: Profile): string {
  const f: ProfileFile = { app: APP_ID, version: FILE_VERSION, name: p.name, settings: p.settings };
  return JSON.stringify(f, null, 2);
}

/** 古いバージョンのファイルを現在の形式へ順に変換する。version n → n+1 の関数を足していく。 */
const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {};

export class ImportError extends Error {}

/** ファイルの中身を検証して Profile にする。失敗時は ImportError で、何も変更しない。 */
export function importProfile(text: string): Profile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('JSONとして読めません');
  }
  if (typeof data !== 'object' || data === null) throw new ImportError('形式が正しくありません');
  let d = data as Record<string, unknown>;
  if (d.app !== APP_ID) throw new ImportError('このアプリのプロファイルではありません');
  if (typeof d.version !== 'number' || !Number.isInteger(d.version) || d.version < 1) throw new ImportError('バージョンが正しくありません');
  if (d.version > FILE_VERSION) throw new ImportError('新しいバージョンのファイルです。アプリを更新してください');
  while ((d.version as number) < FILE_VERSION) {
    const step = MIGRATIONS[d.version as number];
    if (!step) throw new ImportError('古い形式で、変換できません');
    d = { ...step(d), version: (d.version as number) + 1 };
  }
  if (typeof d.name !== 'string') throw new ImportError('プロファイル名がありません');
  try {
    return createProfile(d.name, sanitizeSettings(d.settings));
  } catch (e) {
    throw new ImportError((e as Error).message);
  }
}
