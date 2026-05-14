import { useState } from 'react';
import { useNoteStore } from '../stores/noteStore';
import { useSettingsStore } from '../stores/settingsStore';

const MAX_TABS = 8;

export function TabBar() {
  const { notes, activeNoteIndex, unsavedIds, addNote, removeNote, updateNote, setActiveNoteIndex } =
    useNoteStore();
  const setPaneNoteId = useSettingsStore((s) => s.setPaneNoteId);
  const paneNoteIds = useSettingsStore((s) => s.settings.paneNoteIds);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  function handleAdd() {
    if (notes.length >= MAX_TABS) return;
    const note = addNote();
    setActiveNoteIndex(notes.length);
    // Assign the new note to pane 0 if pane 0 is empty
    if (!paneNoteIds[0]) {
      setPaneNoteId(0, note.id);
    }
  }

  function handleClose(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    // Remove from any pane that holds this note
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
      {notes.map((note, idx) => (
        <div
          key={note.id}
          className={`tab${idx === activeNoteIndex ? ' active' : ''}`}
          onClick={() => setActiveNoteIndex(idx)}
          onDoubleClick={(e) => handleDoubleClick(e, note.id, note.title)}
        >
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

          {unsavedIds.has(note.id) && <span className="tab-unsaved" />}

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
      ))}

      {notes.length < MAX_TABS && (
        <button className="tab-add" onClick={handleAdd} title="New note">
          +
        </button>
      )}
    </div>
  );
}
