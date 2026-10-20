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
      mf.value = '';
    },
  };
}
