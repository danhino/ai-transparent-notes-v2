interface Props {
  charCount: number;
  wordCount: number;
  lineNumber: number;
  detectedLanguage: string | null;
}

export function StatusBar({ charCount, wordCount, lineNumber, detectedLanguage }: Props) {
  return (
    <div className="status-bar">
      <span>{charCount} chars</span>
      <span>{wordCount} words</span>
      <span>Ln {lineNumber}</span>
      {detectedLanguage && <span style={{ color: 'var(--accent)' }}>Detected: {detectedLanguage}</span>}
    </div>
  );
}
