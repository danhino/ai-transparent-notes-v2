import { memo } from 'react';

const FORMAT_LABELS: Record<string, string> = {
  'Auto-detect (Code)':            'Auto',
  'Plain Text (Structured Notes)': 'Plain text',
  'Plain text':                    'Plain text',
  'Markdown':                      'Markdown',
  'HTML Viewer':                   'HTML',
  'HTML/CSS':                      'HTML / CSS',
  'CSS':                           'CSS',
  'JavaScript':                    'JavaScript',
  'TypeScript':                    'TypeScript',
  'JSON':                          'JSON',
  'XML':                           'XML',
  'YAML / ENV':                    'YAML',
  'SQL':                           'SQL',
  'Python':                        'Python',
  'Bash':                          'Bash',
  'PowerShell':                    'PowerShell',
  'C':                             'C',
  'C++':                           'C++',
  'C#':                            'C#',
  'Rust':                          'Rust',
  'Go':                            'Go',
  'Java':                          'Java',
  'RTF':                           'Rich Text',
  'CSV':                           'CSV',
  'INI / Config':                  'INI / Config',
  'Log':                           'Log',
};

const SQL_DIALECT_LABELS: Record<string, string> = {
  'sql':        'SQL',
  'mysql':      'MySQL',
  'postgresql': 'PostgreSQL',
  'sqlite':     'SQLite',
  'tsql':       'T-SQL',
  'plsql':      'PL/SQL',
};

interface Props {
  charCount: number;
  wordCount: number;
  lineNumber: number;
  detectedLanguage: string | null;
  format: string;
  dialect: string;
  selLabel?: string | null;
  lineEnding?: string;
}

export const StatusBar = memo(function StatusBar({ charCount, wordCount, lineNumber, detectedLanguage, format, dialect, selLabel, lineEnding }: Props) {
  const languageLabel = format === 'SQL'
    ? (SQL_DIALECT_LABELS[dialect] ?? 'SQL')
    : (FORMAT_LABELS[format] ?? format);

  return (
    <div className="status-bar">
      <span>{charCount} chars</span>
      <span>{wordCount} words</span>
      <span>Ln {lineNumber}</span>
      {selLabel && <span>{selLabel}</span>}
      {detectedLanguage && <span className="status-lang-badge">Detected: {detectedLanguage}</span>}
      {/* Right side */}
      <span className="status-bar__language">{lineEnding ?? 'Unix (LF)'}</span>
      <span className="status-bar__right-stat">UTF-8</span>
      <span className="status-bar__right-stat">{languageLabel}</span>
    </div>
  );
});
