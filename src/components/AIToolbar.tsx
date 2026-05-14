import { useSettingsStore } from '../stores/settingsStore';

interface Props {
  paneIndex: number;
  disabled: boolean;
  selectedFormat: string;
  onFormatChange: (format: string) => void;
  onAction: (action: 'fix' | 'polish' | 'rephrase' | 'spellcheck' | 'suggest' | 'apply' | 'compare') => void;
}

export function AIToolbar({ disabled, selectedFormat, onFormatChange, onAction }: Props) {
  const formatOptions = useSettingsStore((s) => s.settings.formatOptions);

  return (
    <div className="ai-toolbar">
      <select
        className="format-select"
        value={selectedFormat}
        onChange={(e) => onFormatChange(e.target.value)}
        disabled={disabled}
        title="Format"
      >
        {formatOptions.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <button className="ai-btn" disabled={disabled} onClick={() => onAction('apply')} title="Format / Apply">
        Apply
      </button>
      <button className="ai-btn" disabled={disabled} onClick={() => onAction('fix')} title="Fix code">
        Fix
      </button>
      <button className="ai-btn" disabled={disabled} onClick={() => onAction('polish')} title="Polish writing">
        Polish
      </button>
      <button className="ai-btn" disabled={disabled} onClick={() => onAction('spellcheck')} title="Fix spelling">
        Spell check
      </button>
      <button className="ai-btn" disabled={disabled} onClick={() => onAction('rephrase')} title="Rephrase">
        Rephrase
      </button>
      <button className="ai-btn" disabled={disabled} onClick={() => onAction('suggest')} title="Suggest improvements">
        Suggest
      </button>
      <button className="ai-btn" disabled={disabled} onClick={() => onAction('compare')} title="Compare with another note">
        Compare
      </button>
    </div>
  );
}
