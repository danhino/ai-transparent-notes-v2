import type { NoteEditorRef } from '../components/NoteEditor';
import type React from 'react';

type Ref = React.RefObject<NoteEditorRef | null>;

export const getText = (r: Ref) => r.current?.getText() ?? '';
export const getSel  = (r: Ref) => r.current?.getSelection() ?? '';
export const hasSel  = (r: Ref) => r.current?.hasSelection() ?? false;
export const apply   = (r: Ref, t: string) => r.current?.applyText(t);
export const getCursor = (r: Ref) => r.current?.getCursorOffset() ?? 0;

// Replace selection, or insert at cursor if nothing selected
export const replaceSel = (r: Ref, t: string) => r.current?.replaceSelection(t);

// Wrap selection in prefix+suffix; insert prefix+placeholder+suffix at cursor if no selection
export function wrapSel(r: Ref, prefix: string, suffix: string, placeholder = '') {
  if (hasSel(r)) {
    replaceSel(r, prefix + getSel(r) + suffix);
  } else {
    replaceSel(r, prefix + placeholder + suffix);
  }
}

// Add prefix to each line in selection (or all lines if no selection)
export function addLinePrefix(r: Ref, prefix: string) {
  if (hasSel(r)) {
    replaceSel(r, getSel(r).split('\n').map(l => prefix + l).join('\n'));
  } else {
    apply(r, getText(r).split('\n').map(l => prefix + l).join('\n'));
  }
}

// Remove prefix from each line in selection (or all lines if no selection)
export function removeLinePrefix(r: Ref, prefix: string) {
  const strip = (l: string) => l.startsWith(prefix) ? l.slice(prefix.length) : l;
  if (hasSel(r)) {
    replaceSel(r, getSel(r).split('\n').map(strip).join('\n'));
  } else {
    apply(r, getText(r).split('\n').map(strip).join('\n'));
  }
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
