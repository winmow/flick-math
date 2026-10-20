export type InputMode = 'flick' | 'tap' | 'hold';

/** 学生ごとの設定（段階5で保存・プロファイル化する）。既定値は SPEC §4.2・§5。 */
export interface Settings {
  keyHeight: number; // px 56〜160
  flickDistance: number; // px 12〜100
  showCorners: boolean;
  guardMs: number; // 連続タッチを無視する時間 0〜1000
  minPressMs: number; // 最短押下時間 0〜500
  holdCancelMs: number; // 押し続けて取り消し 1000〜5000。0 = オフ
  mode: InputMode;
  holdMs: number; // 「長押しで選ぶ」の長押し判定時間
}

export const defaultSettings: Settings = {
  keyHeight: 84,
  flickDistance: 30,
  showCorners: true,
  guardMs: 150,
  minPressMs: 0,
  holdCancelMs: 0,
  mode: 'flick',
  holdMs: 500,
};
