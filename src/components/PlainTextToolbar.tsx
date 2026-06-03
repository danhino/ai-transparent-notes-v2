import { useState, useRef, useEffect } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { getText, getSel, hasSel, apply, replaceSel } from '../utils/toolbarUtils';

interface StatusMsg { text: string; type: 'success' | 'error'; }
interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; showInvisibles: boolean; onToggleInvisibles: () => void; }

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function PlainTextToolbar({ editorRef, disabled, showInvisibles, onToggleInvisibles }: Props) {
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showStatus(text: string, type: 'success' | 'error', duration = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ text, type }); timerRef.current = setTimeout(() => setStatus(null), duration);
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function target() { return hasSel(editorRef) ? getSel(editorRef) : getText(editorRef); }
  function applyTarget(t: string) { if (hasSel(editorRef)) replaceSel(editorRef, t); else apply(editorRef, t); }

  function handleWordCount() {
    const t = getText(editorRef);
    const chars = t.length;
    const words = t.trim() ? t.trim().split(/\s+/).length : 0;
    const lines = t.split('\n').length;
    const readMins = Math.max(1, Math.ceil(words / 200));
    showStatus(`${chars} chars, ${words} words, ${lines} lines, ~${readMins} min read`, 'success', 5000);
  }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      {status && <div className={`ctx-status-banner ctx-status-${status.type}`}>{status.text}</div>}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => applyTarget(target().toUpperCase())} disabled={disabled} title="Convert to UPPERCASE">UPPER</button>
        <button className="ctx-btn" onClick={() => applyTarget(target().toLowerCase())} disabled={disabled} title="Convert to lowercase">lower</button>
        <button className="ctx-btn" onClick={() => applyTarget(toTitleCase(target()))} disabled={disabled} title="Convert to Title Case">Title</button>
        {sep}
        <button className="ctx-btn" onClick={() => applyTarget(target().split('\n').sort().join('\n'))} disabled={disabled} title="Sort lines A-Z">Sort A-Z</button>
        <button className="ctx-btn" onClick={() => applyTarget(target().split('\n').sort().reverse().join('\n'))} disabled={disabled} title="Sort lines Z-A">Sort Z-A</button>
        <button className="ctx-btn" onClick={() => applyTarget(target().split('\n').reverse().join('\n'))} disabled={disabled} title="Reverse line order">Reverse</button>
        <button className="ctx-btn" onClick={() => {
          const lines = target().split('\n');
          applyTarget([...new Set(lines)].join('\n'));
          const removed = lines.length - new Set(lines).size;
          if (removed > 0) showStatus(`Removed ${removed} duplicate${removed !== 1 ? 's' : ''}`, 'success', 3000);
        }} disabled={disabled} title="Remove duplicate lines">Dedupe</button>
        {sep}
        <button className="ctx-btn" onClick={handleWordCount} disabled={disabled} title="Show word/character count">Word count</button>
        {sep}
        <button className="ctx-btn" onClick={() => applyTarget(target().split('\n').map(l => l.trim()).join('\n'))} disabled={disabled} title="Trim whitespace from each line">Trim</button>
        <button className="ctx-btn" onClick={() => applyTarget(target().split('\n').map(l => '  ' + l).join('\n'))} disabled={disabled} title="Add 2-space indent to each line">Indent</button>
        <button className="ctx-btn" onClick={() => applyTarget(target().split('\n').map(l => l.startsWith('  ') ? l.slice(2) : l).join('\n'))} disabled={disabled} title="Remove 2-space indent from each line">Outdent</button>
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
}
