import { useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { AiProvider, CLAUDE_MODELS, OPENAI_MODELS } from '../types';

function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  const valid = isValidHex(value);
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <input
        className="settings-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={7}
        placeholder="#rrggbb"
      />
      <div
        className="color-preview"
        style={{ background: valid ? value : 'transparent' }}
      />
    </div>
  );
}

export function SettingsDialog() {
  const { settings, update, setAiProvider, setAiModel } = useSettingsStore();
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const [localKey, setLocalKey] = useState(settings.aiApiKey);
  const [localProvider, setLocalProvider] = useState<AiProvider>(settings.aiProvider);
  const [localModel, setLocalModel] = useState(settings.aiModel);
  const [addedColor, setAddedColor] = useState(settings.diffAddedColor);
  const [deletedColor, setDeletedColor] = useState(settings.diffDeletedColor);
  const [changedColor, setChangedColor] = useState(settings.diffChangedColor);
  const [newFormat, setNewFormat] = useState('');

  const models = localProvider === 'claude' ? CLAUDE_MODELS : OPENAI_MODELS;

  function save() {
    setAiProvider(localProvider);
    setAiModel(localModel);
    update({
      aiApiKey: localKey,
      diffAddedColor: isValidHex(addedColor) ? addedColor : settings.diffAddedColor,
      diffDeletedColor: isValidHex(deletedColor) ? deletedColor : settings.diffDeletedColor,
      diffChangedColor: isValidHex(changedColor) ? changedColor : settings.diffChangedColor,
    });
    setSettingsOpen(false);
  }

  function addFormat() {
    const f = newFormat.trim();
    if (!f || settings.formatOptions.includes(f)) return;
    update({ formatOptions: [...settings.formatOptions, f] });
    setNewFormat('');
  }

  function removeFormat(f: string) {
    update({ formatOptions: settings.formatOptions.filter((x) => x !== f) });
  }

  async function openDataFolder() {
    await openDialog({ directory: true });
  }

  return (
    <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="modal-close" onClick={() => setSettingsOpen(false)}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* AI provider */}
          <div className="settings-section">
            <div className="settings-section-title">AI provider</div>

            <div className="settings-row">
              <span className="settings-label">Provider</span>
              <select
                className="settings-select"
                value={localProvider}
                onChange={(e) => {
                  const p = e.target.value as AiProvider;
                  setLocalProvider(p);
                  setLocalModel(p === 'claude' ? CLAUDE_MODELS[0] : OPENAI_MODELS[0]);
                }}
              >
                <option value="claude">Claude (Anthropic)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div className="settings-row">
              <span className="settings-label">Model</span>
              <select
                className="settings-select"
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <span className="settings-label">
                {localProvider === 'claude' ? 'Anthropic API key' : 'OpenAI API key'}
              </span>
              <input
                type="password"
                className="settings-input"
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>
          </div>

          {/* Diff colors */}
          <div className="settings-section">
            <div className="settings-section-title">Diff colors</div>
            <ColorRow label="Added" value={addedColor} onChange={setAddedColor} />
            <ColorRow label="Deleted" value={deletedColor} onChange={setDeletedColor} />
            <ColorRow label="Changed" value={changedColor} onChange={setChangedColor} />
          </div>

          {/* Format options */}
          <div className="settings-section">
            <div className="settings-section-title">Format options</div>
            <div className="format-list">
              {settings.formatOptions.map((f) => (
                <div key={f} className="format-list-item" style={{ justifyContent: 'space-between' }}>
                  <span>{f}</span>
                  <button
                    style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
                    onClick={() => removeFormat(f)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="settings-row" style={{ marginTop: 8 }}>
              <input
                className="settings-input"
                value={newFormat}
                onChange={(e) => setNewFormat(e.target.value)}
                placeholder="Add format..."
                onKeyDown={(e) => e.key === 'Enter' && addFormat()}
              />
              <button className="settings-btn" onClick={addFormat}>
                Add
              </button>
            </div>
          </div>

          {/* Data folder */}
          <div className="settings-section">
            <div className="settings-section-title">Data</div>
            <div className="settings-row">
              <span className="settings-label" style={{ color: 'var(--subtle-text)', fontSize: 12 }}>
                Settings stored in app data directory
              </span>
              <button className="settings-btn" onClick={openDataFolder}>
                Open folder
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="settings-btn" onClick={() => setSettingsOpen(false)}>
            Cancel
          </button>
          <button className="settings-btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
