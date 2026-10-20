import type { MathfieldElement } from 'mathlive';
import type { EditorCommand, EditorPort } from '../logic/editor';

/** MathLive の <math-field> を EditorPort として扱う */
export function mathfieldPort(mf: MathfieldElement): EditorPort {
  return {
    insert: (latex) => {
      mf.focus();
      mf.insert(latex, { selectionMode: 'placeholder', format: 'latex' });
    },
    command: (name: EditorCommand) => mf.executeCommand(name),
    getLatex: () => mf.getValue('latex'),
    clear: () => {
      // 取り消しで戻せるよう、値の代入ではなく編集操作で消す
      mf.executeCommand('selectAll');
      mf.executeCommand('deleteBackward');
    },
  };
}
