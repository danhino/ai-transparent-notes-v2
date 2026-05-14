interface Props {
  charCount: number;
  wordCount: number;
  lineNumber: number;
  detectedLanguage: string | null;
  savedVisible: boolean;
}

export function StatusBar({ charCount, wordCount, lineNumber, detectedLanguage, savedVisible }: Props) {
  return (
    <div className="status-bar">
      <span>{charCount} chars</span>
      <span>{wordCount} words</span>
      <span>Ln {lineNumber}</span>
      {detectedLanguage && <span style={{ color: 'var(--accent)' }}>{detectedLanguage}</span>}
      {savedVisible && <span className="status-saved">Saved</span>}
    </div>
  );
}
