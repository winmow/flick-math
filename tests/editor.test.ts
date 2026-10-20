import { describe, expect, it } from 'vitest';
import { runAction, type EditorCommand, type EditorPort } from '../src/logic/editor';

function fake(placeholderResult: boolean) {
  const calls: EditorCommand[] = [];
  const port: EditorPort = {
    insert: () => {},
    command: (n) => (calls.push(n), n === 'moveToNextPlaceholder' ? placeholderResult : true),
    getLatex: () => '',
    getLatexClean: () => '',
    getMathMl: () => '',
    clear: () => {},
  };
  return { port, calls };
}

describe('runAction', () => {
  it('基本操作をコマンドに対応づける', () => {
    const { port, calls } = fake(true);
    runAction(port, 'left');
    runAction(port, 'backspace');
    runAction(port, 'undo');
    expect(calls).toEqual(['moveToPreviousChar', 'deleteBackward', 'undo']);
  });
  it('次の空欄: あればそこへ', () => {
    const { port, calls } = fake(true);
    expect(runAction(port, 'nextBlank')).toBe('次の空欄へ移動');
    expect(calls).toEqual(['moveToNextPlaceholder']);
  });
  it('次の空欄: なければ式の末尾へ', () => {
    const { port, calls } = fake(false);
    expect(runAction(port, 'nextBlank')).toContain('末尾');
    expect(calls).toEqual(['moveToNextPlaceholder', 'moveToMathfieldEnd']);
  });
});
