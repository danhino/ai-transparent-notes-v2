import { useMemo } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

type AiAction = 'fix' | 'polish' | 'rephrase' | 'spellcheck' | 'suggest' | 'apply' | 'compare';

interface Props {
  paneIndex: number;
  disabled: boolean;
  selectedFormat: string;
  onFormatChange: (format: string) => void;
  onAction: (action: AiAction) => void;
}

const AI_ACTION_META: Record<string, { label: string; title: string }> = {
  fix:        { label: 'Fix',         title: 'Fix code' },
  polish:     { label: 'Polish',      title: 'Polish writing' },
  spellcheck: { label: 'Spell check', title: 'Fix spelling' },
  rephrase:   { label: 'Rephrase',    title: 'Rephrase' },
  suggest:    { label: 'Suggest',     title: 'Suggest improvements' },
  compare:    { label: 'Compare',     title: 'Compare with another note' },
};

export function AIToolbar({ disabled, selectedFormat, onFormatChange, onAction }: Props) {
  const formatOptions = useSettingsStore((s) => s.settings.formatOptions);
  const rawToolbarActions = useSettingsStore((s) => s.settings.aiToolbarActions);
  // 'apply' is always shown in the fixed slot before the separator; skip it in the dynamic list
  const aiToolbarActions = useMemo(
    () => rawToolbarActions.filter((k) => k !== 'apply'),
    [rawToolbarActions]
  );

  return (
    <div className="ai-toolbar">
      <span className="ai-toolbar-label">AI:</span>
      <div className="ai-toolbar-sep" />

      <span className="ai-toolbar-label">Format:</span>
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
      <button
        className="ai-btn"
        disabled={disabled}
        onClick={() => onAction('apply')}
        title="Format / Apply"
      >
        Apply
      </button>

      <div className="ai-toolbar-sep" />

      {aiToolbarActions.map((key) => {
        const meta = AI_ACTION_META[key];
        if (!meta) return null;
        return (
          <button
            key={key}
            className="ai-btn"
            disabled={disabled}
            onClick={() => onAction(key as AiAction)}
            title={meta.title}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
