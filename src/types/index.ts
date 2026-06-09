export type Theme = 'dark' | 'light' | 'blue' | 'sepia' | 'green';
export type Layout = 'single' | 'side-by-side' | 'top-bottom' | 'grid';
export type AiProvider = 'claude' | 'openai';
export type DiffBlockType = 'equal' | 'added' | 'deleted' | 'changed';
export type Platform = 'windows' | 'macos' | 'linux';
export type RtfStyle = 'Normal' | 'Heading 1' | 'Heading 2' | 'Heading 3' | 'Title' | 'Subtitle' | 'Quote' | 'Code';
export type CsvFormat = 'General' | 'Number' | 'Currency' | 'Percentage' | 'Date' | 'Time' | 'Scientific' | 'Text';
export type Delimiter = 'Comma' | 'Tab' | 'Semicolon' | 'Pipe';
export type XmlNavDirection = 'prev' | 'next' | 'parent';

export interface Note {
  id: string;
  title: string;
  content: string;
  lastModified: string;
  createdAt: string;
  sourceFilePath?: string;
  format?: string;
}

export interface DiffBlock {
  type: DiffBlockType;
  linesA: string[];
  linesB: string[];
  startA: number;
  startB: number;
}

export interface AppSettings {
  theme: Theme;
  fontFamily: string;
  fontSize: number;
  windowOpacity: number;
  alwaysOnTop: boolean;
  windowLeft: number;
  windowTop: number;
  windowWidth: number;
  windowHeight: number;
  activeNoteIndex: number;
  layout: Layout;
  paneNoteIds: (string | null)[];
  aiApiKey: string;
  aiProvider: AiProvider;
  aiModel: string;
  notes: Note[];
  formatOptions: string[];
  diffAddedColor: string;
  diffDeletedColor: string;
  diffChangedColor: string;
  workspacePanelVisible: boolean;
  workspacePanelWidth: number;
  workspaceFolders: string[];
  focusMode: boolean;
  aiToolbarActions: string[];
  mainToolbarItems: string[];
  paneLineNumbers: boolean[];
  showLineNumbersByDefault: boolean;
  uiTextBrightness: number;
  uiBorderOpacity: number;
  uiTextSize: number;
  formatSort?: 'custom' | 'asc' | 'desc';
}

export interface WorkspaceEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: WorkspaceEntry[];
  isLoaded?: boolean;
}

export const CLAUDE_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-7',
];

export const OPENAI_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-3.5-turbo',
];

export const DEFAULT_FORMAT_OPTIONS = [
  'Plain Text (Structured Notes)',
  'Auto-detect (Code)',
  'Python',
  'JavaScript',
  'Java',
  'TypeScript',
  'SQL',
  'Markdown',
  'RTF',
  'CSV',
  'XML',
  'C#',
  'PowerShell',
  'Bash',
  'HTML/CSS',
  'HTML Viewer',
  'C',
  'C++',
  'CSS',
  'Go',
  'INI / Config',
  'JSON',
  'Log',
  'Rust',
  'YAML / ENV',
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontFamily: 'Segoe UI',
  fontSize: 14,
  windowOpacity: 1.0,
  alwaysOnTop: false,
  windowLeft: 100,
  windowTop: 100,
  windowWidth: 960,
  windowHeight: 640,
  activeNoteIndex: 0,
  layout: 'single',
  paneNoteIds: [null, null, null, null],
  aiApiKey: '',
  aiProvider: 'claude',
  aiModel: 'claude-haiku-4-5-20251001',
  notes: [],
  formatOptions: DEFAULT_FORMAT_OPTIONS,
  diffAddedColor: '#1A4D1A',
  diffDeletedColor: '#4D1A1A',
  diffChangedColor: '#4D3D0D',
  workspacePanelVisible: false,
  workspacePanelWidth: 220,
  workspaceFolders: [],
  focusMode: false,
  aiToolbarActions: ['apply', 'fix', 'spellcheck', 'rephrase', 'convo', 'compare', 'suggest', 'polish'],
  mainToolbarItems: ['pin', 'theme', 'font', 'size', 'opacity', 'layout', 'workspace', 'import', 'focus', 'settings'],
  paneLineNumbers: [true, true, true, true],
  showLineNumbersByDefault: true,
  uiTextBrightness: 75,
  uiBorderOpacity: 14,
  uiTextSize: 11,
  formatSort: 'custom',
};
