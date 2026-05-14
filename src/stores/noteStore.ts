import { create } from 'zustand';
import { Note } from '../types';

function makeNote(partial: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    title: 'New note',
    content: '',
    lastModified: new Date().toISOString(),
    ...partial,
  };
}

interface NoteStore {
  notes: Note[];
  activeNoteIndex: number;
  unsavedIds: Set<string>;

  setNotes: (notes: Note[]) => void;
  addNote: (partial?: Partial<Note>) => Note;
  removeNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'sourceFilePath'>>) => void;
  setActiveNoteIndex: (index: number) => void;
  markSaved: (id: string) => void;
  getNote: (id: string) => Note | undefined;
  getActiveNote: () => Note | null;
  openWorkspaceFile: (content: string, sourceFilePath: string) => Note | null;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  activeNoteIndex: 0,
  unsavedIds: new Set(),

  setNotes: (notes) => set({ notes }),

  addNote: (partial = {}) => {
    const note = makeNote(partial);
    set((s) => ({ notes: [...s.notes, note] }));
    return note;
  },

  removeNote: (id) => {
    set((s) => {
      const notes = s.notes.filter((n) => n.id !== id);
      const activeNoteIndex = Math.min(s.activeNoteIndex, Math.max(0, notes.length - 1));
      const unsavedIds = new Set(s.unsavedIds);
      unsavedIds.delete(id);
      return { notes, activeNoteIndex, unsavedIds };
    });
  },

  updateNote: (id, updates) => {
    set((s) => {
      const unsavedIds = new Set(s.unsavedIds);
      unsavedIds.add(id);
      return {
        notes: s.notes.map((n) =>
          n.id === id
            ? { ...n, ...updates, lastModified: new Date().toISOString() }
            : n
        ),
        unsavedIds,
      };
    });
  },

  setActiveNoteIndex: (activeNoteIndex) => set({ activeNoteIndex }),

  markSaved: (id) => {
    set((s) => {
      const unsavedIds = new Set(s.unsavedIds);
      unsavedIds.delete(id);
      return { unsavedIds };
    });
  },

  getNote: (id) => get().notes.find((n) => n.id === id),

  getActiveNote: () => {
    const { notes, activeNoteIndex } = get();
    return notes[activeNoteIndex] ?? null;
  },

  openWorkspaceFile: (content, sourceFilePath) => {
    const normalized = sourceFilePath.replace(/\\/g, '/');
    const { notes } = get();
    const existing = notes.find((n) => n.sourceFilePath?.replace(/\\/g, '/') === normalized);
    if (existing) {
      const idx = notes.indexOf(existing);
      set({ activeNoteIndex: idx });
      return existing;
    }
    if (notes.length >= 8) return null;
    const parts = normalized.split('/');
    const title = parts[parts.length - 1];
    const note = makeNote({ title, content, sourceFilePath: normalized });
    set((s) => ({ notes: [...s.notes, note], activeNoteIndex: s.notes.length }));
    return note;
  },
}));
