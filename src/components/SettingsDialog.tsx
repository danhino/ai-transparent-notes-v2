import { useState, useEffect, CSSProperties } from 'react';
import { appDataDir } from '@tauri-apps/api/path';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import {
  AiProvider, Theme, CLAUDE_MODELS, OPENAI_MODELS,
  DEFAULT_SETTINGS, DEFAULT_FORMAT_OPTIONS,
} from '../types';

const FONT_FAMILIES = [
  'Segoe UI', 'Consolas', 'Cascadia Code', 'Courier New', 'Georgia',
  'Times New Roman', 'Calibri', 'Arial', 'Verdana', 'Tahoma',
  'Trebuchet MS', 'Comic Sans MS',
];

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32];

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'blue', label: 'Blue' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'green', label: 'Green' },
];

const ALL_AI_ACTIONS: { key: string; label: string }[] = [
  { key: 'apply',      label: 'Apply' },
  { key: 'fix',        label: 'Fix' },
  { key: 'polish',     label: 'Polish' },
  { key: 'spellcheck', label: 'Spell check' },
  { key: 'rephrase',   label: 'Rephrase' },
  { key: 'suggest',    label: 'Suggest' },
  { key: 'compare',    label: 'Compare' },
];

const ALL_MAIN_ITEMS: { key: string; label: string }[] = [
  { key: 'pin',       label: 'Always on top' },
  { key: 'theme',     label: 'Theme' },
  { key: 'font',      label: 'Font' },
  { key: 'size',      label: 'Font size' },
  { key: 'opacity',   label: 'Opacity' },
  { key: 'layout',    label: 'Layout' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'import',    label: 'Import' },
  { key: 'focus',     label: 'Focus' },
  { key: 'settings',  label: 'Settings' },
];

function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
        style={{ width: 90 }}
      />
      <div className="color-preview" style={{ background: valid ? value : 'transparent' }} />
    </div>
  );
}

function ReorderList({
  items,
  allItems,
  labelMap,
  onChange,
}: {
  items: string[];
  allItems: { key: string; label: string }[];
  labelMap: Map<string, string>;
  onChange: (v: string[]) => void;
}) {
  const available = allItems.filter((a) => !items.includes(a.key));

  function move(i: number, dir: -1 | 1) {
    const list = [...items];
    const target = i + dir;
    if (target < 0 || target >= list.length) return;
    [list[i], list[target]] = [list[target], list[i]];
    onChange(list);
  }

  function remove(key: string) {
    onChange(items.filter((k) => k !== key));
  }

  function add(key: string) {
    if (!key) return;
    onChange([...items, key]);
  }

  const btnStyle: CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-secondary)', fontSize: 12, padding: '0 3px', lineHeight: 1,
  };
  const removeBtnStyle: CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--danger)', fontSize: 14, padding: '0 3px', lineHeight: 1,
  };

  return (
    <div>
      <div className="format-list">
        {items.map((key, i) => (
          <div key={key} className="format-list-item" style={{ justifyContent: 'space-between' }}>
            <span>{labelMap.get(key) ?? key}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button style={btnStyle} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">▲</button>
              <button style={btnStyle} disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down">▼</button>
              <button style={removeBtnStyle} onClick={() => remove(key)} title="Remove">×</button>
            </div>
          </div>
        ))}
      </div>
      {available.length > 0 && (
        <div className="settings-row" style={{ marginTop: 8 }}>
          <select
            className="settings-select"
            defaultValue=""
            onChange={(e) => { add(e.target.value); e.target.value = ''; }}
          >
            <option value="" disabled>Add item...</option>
            {available.map((a) => (
              <option key={a.key} value={a.key}>{a.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export function SettingsDialog() {
  const { settings, update, setAiProvider, setAiModel } = useSettingsStore();
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const [localKey, setLocalKey] = useState(settings.aiApiKey);
  const [showKey, setShowKey] = useState(false);
  const [localProvider, setLocalProvider] = useState<AiProvider>(settings.aiProvider);
  const [localModel, setLocalModel] = useState(settings.aiModel);
  const [localTheme, setLocalTheme] = useState<Theme>(settings.theme);
  const [localFontFamily, setLocalFontFamily] = useState(settings.fontFamily);
  const [localFontSize, setLocalFontSize] = useState(settings.fontSize);
  const [addedColor, setAddedColor] = useState(settings.diffAddedColor);
  const [deletedColor, setDeletedColor] = useState(settings.diffDeletedColor);
  const [changedColor, setChangedColor] = useState(settings.diffChangedColor);
  const [newFormat, setNewFormat] = useState('');
  const [localFormats, setLocalFormats] = useState<string[]>(settings.formatOptions);
  const [localAiActions, setLocalAiActions] = useState<string[]>(
    settings.aiToolbarActions ?? DEFAULT_SETTINGS.aiToolbarActions
  );
  const [localMainItems, setLocalMainItems] = useState<string[]>(
    settings.mainToolbarItems ?? DEFAULT_SETTINGS.mainToolbarItems
  );
  const [dataPath, setDataPath] = useState('');

  useEffect(() => {
    void appDataDir().then((p) => setDataPath(p)).catch(() => {});
  }, []);

  const models = localProvider === 'claude' ? CLAUDE_MODELS : OPENAI_MODELS;

  const aiLabelMap = new Map(ALL_AI_ACTIONS.map((a) => [a.key, a.label]));
  const mainLabelMap = new Map(ALL_MAIN_ITEMS.map((a) => [a.key, a.label]));

  function save() {
    setAiProvider(localProvider);
    setAiModel(localModel);
    update({
      theme: localTheme,
      fontFamily: localFontFamily,
      fontSize: localFontSize,
      aiApiKey: localKey,
      diffAddedColor: isValidHex(addedColor) ? addedColor : settings.diffAddedColor,
      diffDeletedColor: isValidHex(deletedColor) ? deletedColor : settings.diffDeletedColor,
      diffChangedColor: isValidHex(changedColor) ? changedColor : settings.diffChangedColor,
      formatOptions: localFormats,
      aiToolbarActions: localAiActions,
      mainToolbarItems: localMainItems,
    });
    setSettingsOpen(false);
  }

  function resetToDefaults() {
    setLocalKey(DEFAULT_SETTINGS.aiApiKey);
    setLocalProvider(DEFAULT_SETTINGS.aiProvider as AiProvider);
    setLocalModel(DEFAULT_SETTINGS.aiModel);
    setLocalTheme(DEFAULT_SETTINGS.theme as Theme);
    setLocalFontFamily(DEFAULT_SETTINGS.fontFamily);
    setLocalFontSize(DEFAULT_SETTINGS.fontSize);
    setAddedColor(DEFAULT_SETTINGS.diffAddedColor);
    setDeletedColor(DEFAULT_SETTINGS.diffDeletedColor);
    setChangedColor(DEFAULT_SETTINGS.diffChangedColor);
    setLocalFormats([...DEFAULT_FORMAT_OPTIONS]);
    setLocalAiActions([...DEFAULT_SETTINGS.aiToolbarActions]);
    setLocalMainItems([...DEFAULT_SETTINGS.mainToolbarItems]);
  }

  function addFormat() {
    const f = newFormat.trim();
    if (!f || localFormats.includes(f)) return;
    setLocalFormats((prev) => [...prev, f]);
    setNewFormat('');
  }

  function removeFormat(f: string) {
    setLocalFormats((prev) => prev.filter((x) => x !== f));
  }

  function moveFormat(index: number, dir: -1 | 1) {
    const list = [...localFormats];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    setLocalFormats(list);
  }

  async function openDataFolder() {
    if (!dataPath) return;
    try {
      await revealItemInDir(dataPath);
    } catch (err) {
      console.error('[Settings] Failed to reveal data folder:', err);
    }
  }

  const reorderBtnStyle: CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-secondary)', fontSize: 12, padding: '0 3px', lineHeight: 1,
  };
  const removeBtnStyle: CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--danger)', fontSize: 14, padding: '0 3px', lineHeight: 1,
  };

  return (
    <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="modal-close" onClick={() => setSettingsOpen(false)}>×</button>
        </div>

        <div className="modal-body">

          {/* AI Configuration */}
          <div className="settings-section">
            <div className="settings-section-title">AI configuration</div>

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
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <span className="settings-label">
                {localProvider === 'claude' ? 'Anthropic API key' : 'OpenAI API key'}
              </span>
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  className="settings-input"
                  style={{ flex: 1 }}
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                />
                <button
                  className="settings-btn"
                  onClick={() => setShowKey((v) => !v)}
                  title={showKey ? 'Hide key' : 'Show key'}
                  style={{ flexShrink: 0 }}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {localProvider === 'claude' && (
              <div style={{ fontSize: 11, color: 'var(--subtle-text)', marginBottom: 4, paddingLeft: 130 }}>
                Get your key at console.anthropic.com → API Keys
              </div>
            )}
          </div>

          {/* Appearance */}
          <div className="settings-section">
            <div className="settings-section-title">Appearance</div>

            <div className="settings-row">
              <span className="settings-label">Theme</span>
              <select
                className="settings-select"
                value={localTheme}
                onChange={(e) => setLocalTheme(e.target.value as Theme)}
              >
                {THEMES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <span className="settings-label">Font family</span>
              <select
                className="settings-select"
                value={localFontFamily}
                onChange={(e) => setLocalFontFamily(e.target.value)}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <span className="settings-label">Font size</span>
              <select
                className="settings-select"
                style={{ width: 80 }}
                value={localFontSize}
                onChange={(e) => setLocalFontSize(Number(e.target.value))}
              >
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* AI toolbar */}
          <div className="settings-section">
            <div className="settings-section-title">AI toolbar</div>
            <ReorderList
              items={localAiActions}
              allItems={ALL_AI_ACTIONS}
              labelMap={aiLabelMap}
              onChange={setLocalAiActions}
            />
          </div>

          {/* Main toolbar */}
          <div className="settings-section">
            <div className="settings-section-title">Main toolbar</div>
            <ReorderList
              items={localMainItems}
              allItems={ALL_MAIN_ITEMS}
              labelMap={mainLabelMap}
              onChange={setLocalMainItems}
            />
          </div>

          {/* Format options */}
          <div className="settings-section">
            <div className="settings-section-title">Format options</div>
            <div className="format-list">
              {localFormats.map((f, i) => (
                <div key={f} className="format-list-item" style={{ justifyContent: 'space-between' }}>
                  <span>{f}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button style={reorderBtnStyle} disabled={i === 0} onClick={() => moveFormat(i, -1)} title="Move up">▲</button>
                    <button style={reorderBtnStyle} disabled={i === localFormats.length - 1} onClick={() => moveFormat(i, 1)} title="Move down">▼</button>
                    <button style={removeBtnStyle} onClick={() => removeFormat(f)} title="Remove">×</button>
                  </div>
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
              <button className="settings-btn" onClick={addFormat}>Add</button>
            </div>
          </div>

          {/* Comparison colors */}
          <div className="settings-section">
            <div className="settings-section-title">Comparison colors</div>
            <ColorRow label="Added lines" value={addedColor} onChange={setAddedColor} />
            <ColorRow label="Deleted lines" value={deletedColor} onChange={setDeletedColor} />
            <ColorRow label="Changed lines" value={changedColor} onChange={setChangedColor} />
          </div>

          {/* Storage */}
          <div className="settings-section">
            <div className="settings-section-title">Storage</div>
            <div className="settings-row" style={{ alignItems: 'flex-start', gap: 8 }}>
              <span
                className="settings-label"
                style={{ color: 'var(--subtle-text)', fontSize: 11, wordBreak: 'break-all', flex: 1 }}
              >
                {dataPath || 'Resolving...'}
              </span>
              <button className="settings-btn" onClick={openDataFolder}>Open</button>
            </div>
          </div>

          {/* About */}
          <div className="settings-section">
            <div className="settings-section-title">About</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>AI Transparent Notes v2</div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
                A modern cross-platform notes app with AI assistance
              </div>
              <div style={{ color: 'var(--subtle-text)', fontSize: 11 }}>Version 0.1.0</div>
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="settings-btn" onClick={resetToDefaults} style={{ marginRight: 'auto' }}>
            Reset to defaults
          </button>
          <button className="settings-btn" onClick={() => setSettingsOpen(false)}>Cancel</button>
          <button className="settings-btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
