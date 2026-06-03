import { useState } from 'react';
import { useNoteStore } from '../stores/noteStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';

function formatTooltipDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

const MAX_TABS = 8;

const LANG_DOT_COLORS: Record<string, string> = {
  'Python':      '#3b82f6',
  'JavaScript':  '#eab308',
  'TypeScript':  '#3b82f6',
  'Rust':        '#f97316',
  'SQL':         '#22c55e',
  'HTML/CSS':    '#ef4444',
  'HTML Viewer': '#ef4444',
  'Markdown':    '#a855f7',
};

export function TabBar() {
  const { notes, activeNoteIndex, unsavedIds, addNote, removeNote, updateNote, setActiveNoteIndex } =
    useNoteStore();
  const setPaneNoteId = useSettingsStore((s) => s.setPaneNoteId);
  const paneNoteIds = useSettingsStore((s) => s.settings.paneNoteIds);
  const focusedPaneIndex = useUiStore((s) => s.focusedPaneIndex);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  function handleAdd() {
    if (notes.length >= MAX_TABS) return;
    const note = addNote();
    setActiveNoteIndex(notes.length);
    if (!paneNoteIds[0]) {
      setPaneNoteId(0, note.id);
    }
  }

  function handleClose(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    paneNoteIds.forEach((nid, i) => {
      if (nid === id) setPaneNoteId(i, null);
    });
    removeNote(id);
  }

  function handleDoubleClick(e: React.MouseEvent, id: string, title: string) {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(title);
  }

  function commitRename(id: string) {
    const title = renameValue.trim() || 'New note';
    updateNote(id, { title });
    setRenamingId(null);
  }

  return (
    <div className="tabbar">
      {notes.map((note, idx) => {
        const langDotColor = note.format ? LANG_DOT_COLORS[note.format] : undefined;
        const isActive = idx === activeNoteIndex;
        const isUnsaved = unsavedIds.has(note.id);

        const tabTitle = note.sourceFilePath
          ? `${note.title}\n${note.sourceFilePath}`
          : `${note.title}\n${formatTooltipDate(note.createdAt)}`;

        return (
          <div
            key={note.id}
            className={`tab${isActive ? ' active' : ''}`}
            title={tabTitle}
            onClick={() => {
              setActiveNoteIndex(idx);
              setPaneNoteId(focusedPaneIndex, note.id);
            }}
            onDoubleClick={(e) => handleDoubleClick(e, note.id, note.title)}
          >
            {langDotColor && (
              <span
                className="tab-lang-dot"
                style={{ backgroundColor: langDotColor }}
              />
            )}

            {renamingId === note.id ? (
              <input
                autoFocus
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'inherit',
                  font: 'inherit',
                  width: '100%',
                }}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(note.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(note.id);
                  if (e.key === 'Escape') setRenamingId(null);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="tab-title">{note.title}</span>
            )}

            {isUnsaved && (
              <span className="tab-unsaved" title="Unsaved changes">●</span>
            )}

            {notes.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => handleClose(e, note.id)}
                title="Close"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {notes.length < MAX_TABS && (
        <button className="tab-add" onClick={handleAdd} title="New note">
          +
        </button>
      )}
    </div>
  );
}
