export type InputMode = 'flick' | 'tap' | 'hold';
export type OneHand = 'none' | 'left' | 'right';
export type CopyFormat = 'word' | 'latex' | 'mathml';
export type Theme = 'auto' | 'light' | 'dark' | 'contrast';

/** 学生ごとの設定。既定値と範囲は SPEC §4.2・§5。 */
export interface Settings {
  keyHeight: number;
  columns: number;
  gap: number;
  flickDistance: number;
  guardMs: number;
  minPressMs: number;
  holdCancelMs: number; // 0 = オフ
  mode: InputMode;
  holdMs: number;
  showCorners: boolean;
  oneHand: OneHand;
  mathScale: number; // %
  vibrate: boolean;
  click: boolean;
  speak: boolean;
  theme: Theme;
  copyFormat: CopyFormat; // 最後に選んだコピー形式
}

export const defaultSettings: Settings = {
  keyHeight: 84,
  columns: 4,
  gap: 8,
  flickDistance: 30,
  guardMs: 150,
  minPressMs: 0,
  holdCancelMs: 0,
  mode: 'flick',
  holdMs: 500,
  showCorners: true,
  oneHand: 'none',
  mathScale: 150,
  vibrate: false,
  click: false,
  speak: false,
  theme: 'auto',
  copyFormat: 'word',
};

type Rule =
  | { type: 'number'; min: number; max: number; zeroOk?: boolean }
  | { type: 'boolean' }
  | { type: 'enum'; values: readonly string[] };

export const SETTING_RULES: Record<keyof Settings, Rule> = {
  keyHeight: { type: 'number', min: 56, max: 160 },
  columns: { type: 'number', min: 3, max: 5 },
  gap: { type: 'number', min: 4, max: 24 },
  flickDistance: { type: 'number', min: 12, max: 100 },
  guardMs: { type: 'number', min: 0, max: 1000 },
  minPressMs: { type: 'number', min: 0, max: 500 },
  holdCancelMs: { type: 'number', min: 1000, max: 5000, zeroOk: true },
  mode: { type: 'enum', values: ['flick', 'tap', 'hold'] },
  holdMs: { type: 'number', min: 300, max: 1500 },
  showCorners: { type: 'boolean' },
  oneHand: { type: 'enum', values: ['none', 'left', 'right'] },
  mathScale: { type: 'number', min: 100, max: 300 },
  vibrate: { type: 'boolean' },
  click: { type: 'boolean' },
  speak: { type: 'boolean' },
  theme: { type: 'enum', values: ['auto', 'light', 'dark', 'contrast'] },
  copyFormat: { type: 'enum', values: ['word', 'latex', 'mathml'] },
};

/**
 * 外部から来た設定を検証して Settings にする。
 * 型が違う値は例外、範囲外の数値は範囲内に丸める、欠けた項目は既定値、知らない項目は捨てる。
 */
export function sanitizeSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('設定の形式が正しくありません');
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...defaultSettings };
  for (const [k, rule] of Object.entries(SETTING_RULES)) {
    if (!(k in src)) continue;
    const v = src[k];
    if (rule.type === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`設定 ${k} が数値ではありません`);
      out[k] = rule.zeroOk && v === 0 ? 0 : Math.round(Math.min(rule.max, Math.max(rule.min, v)));
    } else if (rule.type === 'boolean') {
      if (typeof v !== 'boolean') throw new Error(`設定 ${k} が真偽値ではありません`);
      out[k] = v;
    } else {
      if (typeof v !== 'string' || !rule.values.includes(v)) throw new Error(`設定 ${k} の値が正しくありません`);
      out[k] = v;
    }
  }
  return out as unknown as Settings;
}
