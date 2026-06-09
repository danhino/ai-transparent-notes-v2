import { create } from 'zustand';
import { Note } from '../types';

// Map file extensions to format names
const EXT_TO_FORMAT: Record<string, string> = {
  '.md': 'Markdown',
  '.py': 'Python',
  '.js': 'JavaScript',
  '.mjs': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.java': 'Java',
  '.cs': 'C#',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.sql': 'SQL',
  '.html': 'HTML/CSS',
  '.htm': 'HTML/CSS',
  '.css': 'HTML/CSS',
  '.scss': 'HTML/CSS',
  '.ps1': 'PowerShell',
  '.sh': 'Bash',
  '.json': 'JSON',
  '.rtf': 'RTF',
  '.csv': 'CSV',
  '.xml': 'XML',
  '.rs': 'Rust',
  '.go': 'Go',
  '.yaml': 'YAML / ENV',
  '.yml': 'YAML / ENV',
  '.ini': 'INI / Config',
  '.cfg': 'INI / Config',
  '.conf': 'INI / Config',
  '.env': 'INI / Config',
  '.log': 'Log',
};

function detectFormat(filename: string, content: string): string {
  const sample = content.slice(0, 8192);
  const lines = sample.split('\n');
  const firstLine = lines[0].trim();
  const trimmed = sample.trimStart();

  // Shebang — definitive interpreter signal
  if (firstLine.startsWith('#!')) {
    if (/python/.test(firstLine)) return 'Python';
    if (/\bnode\b/.test(firstLine)) return 'JavaScript';
    if (/\b(bash|sh)\b/.test(firstLine)) return 'Bash';
  }

  // RTF binary header
  if (trimmed.startsWith('{\\rtf')) return 'RTF';

  // XML declaration or xmlns attribute
  if (/^<\?xml\b/.test(firstLine) || /\bxmlns\s*=/.test(sample)) return 'XML';

  // HTML doctype or root element
  if (/^<!doctype\s+html\b/i.test(firstLine) || /^<html[\s>]/i.test(firstLine)) return 'HTML/CSS';

  // JSON: starts with { or [ and contains "key": pattern
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && /"[\w$-]+"[\s\S]{0,3}:/.test(sample)) return 'JSON';

  // SQL: recognizable DML/DDL keywords
  if (/\b(CREATE\s+TABLE|SELECT\s+\S.*\bFROM\b|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DROP\s+TABLE|ALTER\s+TABLE)\b/i.test(sample)) return 'SQL';

  // TypeScript before JavaScript — requires type-specific syntax
  if (/\b(interface\s+\w+\s*\{|type\s+\w+\s*=\s*[{|(]|:\s*(string|number|boolean|void|any|never|unknown)\b)/.test(sample) &&
      /\b(const|let|var|function|=>|import|export)\b/.test(sample)) return 'TypeScript';

  // JavaScript
  if (/\b(function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|=>\s*[\({]|require\s*\(|module\.exports|import\s+\S+\s+from\s+['"])\b/.test(sample)) return 'JavaScript';

  // Python — def/class/from-import, no JS keywords
  if (/\b(def\s+\w+\s*\(|class\s+\w+[:(]|from\s+[\w.]+\s+import)\b/.test(sample) &&
      !/\b(function|const|let|var)\b/.test(sample)) return 'Python';

  // C# — before C/C++ to catch namespace/using
  if (/\b(namespace\s+\w+|using\s+System;?|Console\.Write(Line)?|class\s+\w+\s*[:{])\b/.test(sample)) return 'C#';

  // Java
  if (/\b(public\s+(class|interface|enum)\s+\w+|System\.out\.print(ln)?|import\s+java\.|@Override)\b/.test(sample)) return 'Java';

  // C++ — before C to catch std:: and iostreams
  if (/\b(#include\s*<(iostream|vector|string|map|algorithm|memory|fstream)>|std::[a-z]|cout\s*<<|cin\s*>>)\b/.test(sample)) return 'C++';

  // C
  if (/\b(#include\s*<(stdio|stdlib|string|math|time)\.h>|printf\s*\(|scanf\s*\(|malloc\s*\(|int\s+main\s*\()\b/.test(sample)) return 'C';

  // Rust
  if (/\b(fn\s+\w+\s*[(<]|let\s+mut\s+\w+|impl\s+\w+|use\s+std::|#\[derive\()/.test(sample)) return 'Rust';

  // PowerShell
  if (/\b(param\s*\(|Write-Host\b|Get-\w{3,}|Set-\w{3,}|Invoke-\w+|-ErrorAction|-Verbose)\b/.test(sample)) return 'PowerShell';

  // Bash/Shell
  if (/^(if\s+\[|for\s+\w+\s+in\s|while\s+\[|case\s+\S+\s+in\b)/m.test(sample) ||
      (/\becho\b/.test(sample) && /\$[\w{]/.test(sample))) return 'Bash';

  // Markdown — lower priority; # is a comment in many languages
  const mdHeadings = lines.filter(l => /^#{1,6} \S/.test(l)).length;
  const mdSignals = (mdHeadings >= 1 ? 1 : 0) +
    (/\*\*\w/.test(sample) ? 1 : 0) +
    (/^```[\w]*$/m.test(sample) ? 1 : 0) +
    (/\[.+\]\(.+\)/.test(sample) ? 1 : 0);
  if (mdSignals >= 2 || mdHeadings >= 3) return 'Markdown';

  // HTML: common tags present even without doctype
  if (/<(html|head|body|div|span|p|h[1-6])\b[^>]*>/i.test(sample)) return 'HTML/CSS';

  // Extension fallback when content is ambiguous
  const normalized = filename.replace(/\\/g, '/');
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot >= 0) {
    const ext = normalized.slice(lastDot).toLowerCase();
    const fromExt = EXT_TO_FORMAT[ext];
    if (fromExt) return fromExt;
  }

  return 'Plain Text';
}

function makeNote(partial: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'New note',
    content: '',
    lastModified: now,
    createdAt: now,
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
  setNoteFormat: (id: string, format: string) => void;
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

  setNoteFormat: (id, format) => {
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, format } : n)),
    }));
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
    const format = detectFormat(normalized, content);
    const note = makeNote({ title, content, sourceFilePath: normalized, format });
    set((s) => ({ notes: [...s.notes, note], activeNoteIndex: s.notes.length }));
    return note;
  },
}));
