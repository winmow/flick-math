/** 数式エディタ操作の抽象。MathLive以外（Wordアドイン等）にも差し替えられる。 */
export interface EditorPort {
  insert(latex: string): void;
  command(name: EditorCommand): boolean;
  getLatex(): string;
  /** 空欄（\placeholder）を取り除いたLaTeX。コピー用 */
  getLatexClean(): string;
  getMathMl(): string;
  clear(): void;
}

export type EditorCommand =
  | 'moveToPreviousChar'
  | 'moveToNextChar'
  | 'moveUp'
  | 'moveDown'
  | 'moveToNextPlaceholder'
  | 'moveToMathfieldEnd'
  | 'deleteBackward'
  | 'undo'
  | 'redo';

export type ActionId = 'left' | 'right' | 'up' | 'down' | 'nextBlank' | 'backspace' | 'undo' | 'redo';

/** 読み上げ用の操作名（aria-live で通知する） */
export const ACTION_LABELS: Record<ActionId, string> = {
  left: '左へ移動',
  right: '右へ移動',
  up: '上の欄へ移動',
  down: '下の欄へ移動',
  nextBlank: '次の空欄へ移動',
  backspace: '1つ消しました',
  undo: '取り消しました',
  redo: 'やり直しました',
};

const MAP: Record<Exclude<ActionId, 'nextBlank'>, EditorCommand> = {
  left: 'moveToPreviousChar',
  right: 'moveToNextChar',
  up: 'moveUp',
  down: 'moveDown',
  backspace: 'deleteBackward',
  undo: 'undo',
  redo: 'redo',
};

/** 操作を実行し、通知用メッセージを返す */
export function runAction(port: EditorPort, id: ActionId): string {
  if (id === 'nextBlank') {
    // 空欄がなければ式の末尾へ（§4.5）
    if (!port.command('moveToNextPlaceholder')) {
      port.command('moveToMathfieldEnd');
      return '空欄はありません。式の末尾へ移動しました';
    }
    return ACTION_LABELS.nextBlank;
  }
  port.command(MAP[id]);
  return ACTION_LABELS[id];
}
