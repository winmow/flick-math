/** 学生ごとの設定（段階5で保存・プロファイル化する）。既定値は SPEC §5。 */
export interface Settings {
  keyHeight: number; // px 56〜160
  flickDistance: number; // px 12〜100
  showCorners: boolean;
}

export const defaultSettings: Settings = {
  keyHeight: 84,
  flickDistance: 30,
  showCorners: true,
};
