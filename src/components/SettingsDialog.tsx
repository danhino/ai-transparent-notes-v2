import { useState, useEffect, useRef } from 'react';
import { DraggableList } from './DraggableList';
import { appDataDir } from '@tauri-apps/api/path';
import { getVersion } from '@tauri-apps/api/app';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import {
  AiProvider, Theme, CLAUDE_MODELS, OPENAI_MODELS, DEEPSEEK_MODELS, OLLAMA_DEFAULT_URL,
  DEFAULT_SETTINGS, DEFAULT_FORMAT_OPTIONS,
} from '../types';
import { detectOllama, fetchOllamaModels } from '../services/aiService';

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

const ALL_PANE_HEADER_ITEMS: { key: string; label: string }[] = [
  { key: 'note-select',   label: 'Note selector' },
  { key: 'rename',        label: 'Rename' },
  { key: 'format-select', label: 'Format selector' },
  { key: 'format-toolbar-toggle', label: 'Format toolbar toggle' },
  { key: 'sep-1',         label: 'Separator' },
  { key: 'ai',            label: 'AI (Ctrl+K)' },
  { key: 'overflow',      label: 'More actions' },
  { key: 'sep-2',         label: 'Separator' },
  { key: 'export',        label: 'Export' },
  { key: 'linenumbers',   label: 'Line numbers' },
  { key: 'chat',          label: 'AI chat' },
];

function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="comparison-color-row">
      <span className="comparison-color-label">{label}</span>
      <div className="comparison-color-swatch-wrapper" title={`Click to change ${label} color`}>
        <div className="comparison-color-swatch" style={{ background: value }} />
        <input
          type="color"
          value={isValidHex(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', border: 'none', padding: 0,
          }}
        />
      </div>
      <span className="comparison-color-hex">{value}</span>
    </div>
  );
}

function applyComparisonColors(added: string, deleted: string, changed: string) {
  const root = document.documentElement;
  root.style.setProperty('--comparison-added', added);
  root.style.setProperty('--comparison-deleted', deleted);
  root.style.setProperty('--comparison-changed', changed);
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

  function swap(i: number, dir: -1 | 1) {
    const list = [...items];
    const target = i + dir;
    if (target < 0 || target >= list.length) return;
    [list[i], list[target]] = [list[target], list[i]];
    onChange(list);
  }

  return (
    <div>
      <DraggableList
        items={items}
        getLabel={(k) => labelMap.get(k) ?? k}
        onReorder={onChange}
        onRemove={(i) => onChange(items.filter((_, idx) => idx !== i))}
        onMoveUp={(i) => swap(i, -1)}
        onMoveDown={(i) => swap(i, 1)}
      />
      {available.length > 0 && (
        <div className="settings-row" style={{ marginTop: 8 }}>
          <select
            className="settings-select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onChange([...items, e.target.value]);
              e.target.value = '';
            }}
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
  const { settings, update, setAiProvider, setAiModel, setShowLineNumbersByDefault } = useSettingsStore();
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const [localClaudeKey, setLocalClaudeKey] = useState(settings.claudeApiKey);
  const [localOpenaiKey, setLocalOpenaiKey] = useState(settings.openaiApiKey);
  const [localDeepseekKey, setLocalDeepseekKey] = useState(settings.deepseekApiKey);
  const [showKey, setShowKey] = useState(false);
  const [localProvider, setLocalProvider] = useState<AiProvider>(settings.aiProvider);
  const localKey = localProvider === 'claude' ? localClaudeKey
    : localProvider === 'deepseek' ? localDeepseekKey
    : localOpenaiKey;
  const setLocalKey = localProvider === 'claude' ? setLocalClaudeKey
    : localProvider === 'deepseek' ? setLocalDeepseekKey
    : setLocalOpenaiKey;
  const [localModel, setLocalModel] = useState(settings.aiModel);
  const [localOllamaUrl, setLocalOllamaUrl] = useState(settings.ollamaUrl || OLLAMA_DEFAULT_URL);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<{ name: string; description: string }[]>([]);
  const [localTheme, setLocalTheme] = useState<Theme>(settings.theme);
  const [localFontFamily, setLocalFontFamily] = useState(settings.fontFamily);
  const [localFontSize, setLocalFontSize] = useState(settings.fontSize);
  const [addedColor, setAddedColor] = useState(settings.diffAddedColor);
  const [deletedColor, setDeletedColor] = useState(settings.diffDeletedColor);
  const [changedColor, setChangedColor] = useState(settings.diffChangedColor);
  const [newFormat, setNewFormat] = useState('');
  const [localLineNumbers, setLocalLineNumbers] = useState<boolean>(
    settings.showLineNumbersByDefault ?? true
  );
  const [localTextBrightness, setLocalTextBrightness] = useState(settings.uiTextBrightness ?? 75);
  const [localTextSize, setLocalTextSize] = useState(settings.uiTextSize ?? 11);
  const [localBorderOpacity, setLocalBorderOpacity] = useState(settings.uiBorderOpacity ?? 14);
  const [localFormats, setLocalFormats] = useState<string[]>(settings.formatOptions);
  const [localFormatSort, setLocalFormatSort] = useState<'custom' | 'asc' | 'desc'>(
    settings.formatSort ?? 'custom'
  );
  const customOrderRef = useRef<string[]>(settings.formatOptions);
  const [localAiActions, setLocalAiActions] = useState<string[]>(
    settings.aiToolbarActions ?? DEFAULT_SETTINGS.aiToolbarActions
  );
  const [localMainItems, setLocalMainItems] = useState<string[]>(
    settings.mainToolbarItems ?? DEFAULT_SETTINGS.mainToolbarItems
  );
  const [localPaneHeaderItems, setLocalPaneHeaderItems] = useState<string[]>(
    settings.paneHeaderItems ?? DEFAULT_SETTINGS.paneHeaderItems
  );
  const [dataPath, setDataPath] = useState('');
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    void appDataDir().then((p) => setDataPath(p)).catch(() => {});
    void getVersion().then((v) => setAppVersion(v)).catch(() => {});
  }, []);

  useEffect(() => {
    applyComparisonColors(settings.diffAddedColor, settings.diffDeletedColor, settings.diffChangedColor);
  }, []);

  useEffect(() => {
    if (localProvider !== 'ollama') return;
    let cancelled = false;
    setOllamaConnected(null);
    (async () => {
      const ok = await detectOllama(localOllamaUrl);
      if (cancelled) return;
      setOllamaConnected(ok);
      if (ok) {
        const fetched = await fetchOllamaModels(localOllamaUrl);
        if (cancelled) return;
        setOllamaModels(fetched);
        if (fetched.length > 0 && !fetched.some((m) => m.name === localModel)) {
          setLocalModel(fetched[0].name);
        }
      } else {
        setOllamaModels([]);
      }
    })();
    return () => { cancelled = true; };
  }, [localProvider, localOllamaUrl]);

  const cloudModels = localProvider === 'claude'
    ? CLAUDE_MODELS
    : localProvider === 'openai'
      ? OPENAI_MODELS
      : localProvider === 'deepseek'
        ? DEEPSEEK_MODELS
        : null;
  const modelOptions = cloudModels
    ? cloudModels.map((m) => ({ value: m.value, label: `${m.label} — ${m.description}` }))
    : ollamaModels.map((m) => ({ value: m.name, label: `${m.name} — ${m.description}` }));

  const mainLabelMap = new Map(ALL_MAIN_ITEMS.map((a) => [a.key, a.label]));
  const paneHeaderLabelMap = new Map(ALL_PANE_HEADER_ITEMS.map((a) => [a.key, a.label]));

  function applyContrastPreview(brightness: number, borderOpacity: number, textSize: number) {
    document.documentElement.style.setProperty('--ui-text-brightness', `${brightness / 100}`);
    document.documentElement.style.setProperty('--ui-border-opacity', `${borderOpacity / 100}`);
    document.documentElement.style.setProperty('--ui-text-size', `${textSize}px`);
  }

  function handleCancel() {
    applyContrastPreview(
      settings.uiTextBrightness ?? 75,
      settings.uiBorderOpacity ?? 14,
      settings.uiTextSize ?? 11,
    );
    applyComparisonColors(settings.diffAddedColor, settings.diffDeletedColor, settings.diffChangedColor);
    setSettingsOpen(false);
  }

  function save() {
    setAiProvider(localProvider);
    setAiModel(localModel);
    setShowLineNumbersByDefault(localLineNumbers);
    update({
      theme: localTheme,
      fontFamily: localFontFamily,
      fontSize: localFontSize,
      aiApiKey: '',
      claudeApiKey: localClaudeKey,
      openaiApiKey: localOpenaiKey,
      deepseekApiKey: localDeepseekKey,
      ollamaUrl: localOllamaUrl,
      diffAddedColor: isValidHex(addedColor) ? addedColor : settings.diffAddedColor,
      diffDeletedColor: isValidHex(deletedColor) ? deletedColor : settings.diffDeletedColor,
      diffChangedColor: isValidHex(changedColor) ? changedColor : settings.diffChangedColor,
      formatOptions: localFormats,
      formatSort: localFormatSort,
      aiToolbarActions: localAiActions,
      mainToolbarItems: localMainItems,
      paneHeaderItems: localPaneHeaderItems,
      showLineNumbersByDefault: localLineNumbers,
      uiTextBrightness: localTextBrightness,
      uiBorderOpacity: localBorderOpacity,
      uiTextSize: localTextSize,
    });
    setSettingsOpen(false);
  }

  function resetToDefaults() {
    setLocalClaudeKey('');
    setLocalOpenaiKey('');
    setLocalDeepseekKey('');
    setLocalProvider(DEFAULT_SETTINGS.aiProvider as AiProvider);
    setLocalModel(DEFAULT_SETTINGS.aiModel);
    setLocalOllamaUrl(DEFAULT_SETTINGS.ollamaUrl);
    setLocalTheme(DEFAULT_SETTINGS.theme as Theme);
    setLocalFontFamily(DEFAULT_SETTINGS.fontFamily);
    setLocalFontSize(DEFAULT_SETTINGS.fontSize);
    setAddedColor(DEFAULT_SETTINGS.diffAddedColor);
    setDeletedColor(DEFAULT_SETTINGS.diffDeletedColor);
    setChangedColor(DEFAULT_SETTINGS.diffChangedColor);
    setLocalFormats([...DEFAULT_FORMAT_OPTIONS]);
    setLocalFormatSort('custom');
    customOrderRef.current = [...DEFAULT_FORMAT_OPTIONS];
    setLocalAiActions([...DEFAULT_SETTINGS.aiToolbarActions]);
    setLocalMainItems([...DEFAULT_SETTINGS.mainToolbarItems]);
    setLocalPaneHeaderItems([...DEFAULT_SETTINGS.paneHeaderItems]);
    setLocalLineNumbers(DEFAULT_SETTINGS.showLineNumbersByDefault);
    setLocalTextBrightness(DEFAULT_SETTINGS.uiTextBrightness);
    setLocalTextSize(DEFAULT_SETTINGS.uiTextSize);
    setLocalBorderOpacity(DEFAULT_SETTINGS.uiBorderOpacity);
    applyContrastPreview(DEFAULT_SETTINGS.uiTextBrightness, DEFAULT_SETTINGS.uiBorderOpacity, DEFAULT_SETTINGS.uiTextSize);
  }

  function addFormat() {
    const f = newFormat.trim();
    if (!f || localFormats.includes(f)) return;
    const next = [...localFormats, f];
    customOrderRef.current = next;
    setLocalFormats(next);
    setLocalFormatSort('custom');
    setNewFormat('');
  }

  function restoreFormat(f: string) {
    if (localFormats.includes(f)) return;
    const next = [...localFormats, f];
    customOrderRef.current = next;
    setLocalFormats(next);
    setLocalFormatSort('custom');
  }

  function moveFormat(index: number, dir: -1 | 1) {
    const list = [...localFormats];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    customOrderRef.current = list;
    setLocalFormats(list);
    setLocalFormatSort('custom');
  }

  function handleFormatReorder(newOrder: string[]) {
    customOrderRef.current = newOrder;
    setLocalFormats(newOrder);
    setLocalFormatSort('custom');
  }

  function handleSortChange(sort: 'custom' | 'asc' | 'desc') {
    if (sort === 'asc') {
      customOrderRef.current = [...localFormats];
      setLocalFormats([...localFormats].sort((a, b) => a.localeCompare(b)));
    } else if (sort === 'desc') {
      customOrderRef.current = [...localFormats];
      setLocalFormats([...localFormats].sort((a, b) => b.localeCompare(a)));
    } else {
      setLocalFormats([...customOrderRef.current]);
    }
    setLocalFormatSort(sort);
  }

  async function openDataFolder() {
    if (!dataPath) return;
    try {
      await revealItemInDir(dataPath);
    } catch (err) {
      console.error('[Settings] Failed to reveal data folder:', err);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="modal-close" onClick={handleCancel}>×</button>
        </div>

        <div className="modal-body">

          {/* AI Configuration */}
          <div className="settings-section">
            <div className="settings-section-title">AI configuration</div>
            <div className="settings-section-desc">Configure your AI provider, model, and API key for note assistance features.</div>

            <div className="settings-row">
              <span className="settings-label">Provider</span>
              <select
                className="settings-select"
                value={localProvider}
                onChange={(e) => {
                  const p = e.target.value as AiProvider;
                  setLocalProvider(p);
                  if (p === 'claude') setLocalModel(CLAUDE_MODELS[0].value);
                  else if (p === 'openai') setLocalModel(OPENAI_MODELS[0].value);
                  else if (p === 'deepseek') setLocalModel(DEEPSEEK_MODELS[0].value);
                }}
              >
                <option value="claude">Claude (Anthropic)</option>
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>

            <div className="settings-row">
              <span className="settings-label">Model</span>
              <select
                className="settings-select"
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                disabled={localProvider === 'ollama' && modelOptions.length === 0}
              >
                {modelOptions.length > 0 ? (
                  modelOptions.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))
                ) : (
                  <option value="">
                    {localProvider === 'ollama' ? 'No models found' : ''}
                  </option>
                )}
              </select>
            </div>
            {localProvider === 'ollama' && (
              <div style={{ fontSize: 11, color: 'var(--subtle-text)', marginBottom: 4, paddingLeft: 130 }}>
                Smaller models (7B) respond faster. Code-focused models work best for Fix and Format; general-purpose models work better for Rephrase, Polish, and Convo.
              </div>
            )}

            {localProvider === 'ollama' ? (
              <>
                <div className="settings-row">
                  <span className="settings-label">Ollama URL</span>
                  <div style={{ display: 'flex', gap: 4, flex: 1, alignItems: 'center' }}>
                    <input
                      type="text"
                      className="settings-input"
                      style={{ flex: 1 }}
                      value={localOllamaUrl}
                      onChange={(e) => setLocalOllamaUrl(e.target.value)}
                      placeholder="http://127.0.0.1:11434"
                    />
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background:
                          ollamaConnected === null ? '#888'
                          : ollamaConnected ? '#4caf50'
                          : '#f44336',
                      }}
                      title={
                        ollamaConnected === null ? 'Checking...'
                        : ollamaConnected ? 'Connected'
                        : 'Not reachable'
                      }
                    />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--subtle-text)', marginBottom: 4, paddingLeft: 130 }}>
                  {ollamaConnected === null
                    ? 'Detecting Ollama...'
                    : ollamaConnected
                      ? `Connected, ${ollamaModels.length} model${ollamaModels.length === 1 ? '' : 's'} available`
                      : 'Ollama not detected. Install from ollama.com and run "ollama serve"'}
                </div>
              </>
            ) : (
              <>
                <div className="settings-row">
                  <span className="settings-label">
                    {localProvider === 'claude' ? 'Anthropic API key' : localProvider === 'deepseek' ? 'DeepSeek API key' : 'OpenAI API key'}
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
                      style={{ flexShrink: 0, padding: '5px 10px', lineHeight: 0 }}
                    >
                      {showKey ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                {localProvider === 'claude' && (
                  <div style={{ fontSize: 11, color: 'var(--subtle-text)', marginBottom: 4, paddingLeft: 130 }}>
                    Get your key at console.anthropic.com → API Keys
                  </div>
                )}
                {localProvider === 'deepseek' && (
                  <div style={{ fontSize: 11, color: 'var(--subtle-text)', marginBottom: 4, paddingLeft: 130 }}>
                    Get your key at platform.deepseek.com → API Keys
                  </div>
                )}
              </>
            )}
          </div>

          {/* Appearance */}
          <div className="settings-section">
            <div className="settings-section-title">Appearance</div>
            <div className="settings-section-desc">Customize the look and feel of the application.</div>

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

            <div className="settings-row">
              <span className="settings-label">Line numbers</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={localLineNumbers}
                  onChange={(e) => setLocalLineNumbers(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                />
                Show line numbers by default
              </label>
            </div>

            {/* UI contrast subsection */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '12px 0 8px 0', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              UI contrast
            </div>

            <div className="settings-row">
              <span className="settings-label" style={{ width: 120, flexShrink: 0 }}>Text brightness</span>
              <input
                type="range"
                min={30} max={90} step={5}
                value={localTextBrightness}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLocalTextBrightness(v);
                  applyContrastPreview(v, localBorderOpacity, localTextSize);
                }}
                style={{ flex: 1, accentColor: 'var(--accent-color)' }}
              />
              <span style={{ width: 36, textAlign: 'right', color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
                {localTextBrightness}%
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', paddingLeft: 130, marginTop: -2, marginBottom: 8 }}>
              Controls how bright labels and inactive buttons appear. Higher = more visible.
            </div>

            <div className="settings-row">
              <span className="settings-label" style={{ width: 120, flexShrink: 0 }}>UI text size</span>
              <input
                type="range"
                min={9} max={14} step={1}
                value={localTextSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLocalTextSize(v);
                  applyContrastPreview(localTextBrightness, localBorderOpacity, v);
                }}
                style={{ flex: 1, accentColor: 'var(--accent-color)' }}
              />
              <span style={{ width: 36, textAlign: 'right', color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
                {localTextSize}px
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', paddingLeft: 130, marginTop: -2, marginBottom: 8 }}>
              Controls the size of labels, buttons, and toolbar text globally.
            </div>

            <div className="settings-row">
              <span className="settings-label" style={{ width: 120, flexShrink: 0 }}>Border visibility</span>
              <input
                type="range"
                min={0} max={40} step={5}
                value={localBorderOpacity}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLocalBorderOpacity(v);
                  applyContrastPreview(localTextBrightness, v, localTextSize);
                }}
                style={{ flex: 1, accentColor: 'var(--accent-color)' }}
              />
              <span style={{ width: 36, textAlign: 'right', color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
                {localBorderOpacity}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', paddingLeft: 130, marginTop: -2, marginBottom: 4 }}>
              Controls how visible the dividing lines are between UI sections. 0 = invisible, 40 = strong.
            </div>
          </div>

          {/* Main toolbar */}
          <div className="settings-section">
            <div className="settings-section-title">Main toolbar</div>
            <div className="settings-section-desc">Add, remove, or reorder the groups shown in the main toolbar (theme, font, opacity, etc.).</div>
            <ReorderList
              items={localMainItems}
              allItems={ALL_MAIN_ITEMS}
              labelMap={mainLabelMap}
              onChange={setLocalMainItems}
            />
          </div>

          {/* Pane header */}
          <div className="settings-section">
            <div className="settings-section-title">Pane header</div>
            <div className="settings-section-desc">Add, remove, or reorder the controls shown in each pane's header bar.</div>
            <ReorderList
              items={localPaneHeaderItems}
              allItems={ALL_PANE_HEADER_ITEMS}
              labelMap={paneHeaderLabelMap}
              onChange={setLocalPaneHeaderItems}
            />
          </div>

          {/* Format options */}
          <div className="settings-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <div className="settings-section-title" style={{ marginBottom: 0 }}>Format options</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {(['asc', 'desc', 'custom'] as const).map((opt) => (
                  <button
                    key={opt}
                    className="settings-btn"
                    style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      background: localFormatSort === opt ? 'var(--accent-color)' : undefined,
                      color: localFormatSort === opt ? '#fff' : undefined,
                      borderColor: localFormatSort === opt ? 'var(--accent-color)' : undefined,
                      opacity: localFormatSort === opt ? 1 : 0.65,
                    }}
                    onClick={() => handleSortChange(opt)}
                  >
                    {opt === 'asc' ? 'A→Z' : opt === 'desc' ? 'Z→A' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-section-desc">Manage the list of formats shown in the pane header format selector. Add custom languages or text types.</div>
            <DraggableList
              items={localFormats}
              onReorder={handleFormatReorder}
              onRemove={(i) => {
                const next = localFormats.filter((_, idx) => idx !== i);
                customOrderRef.current = next;
                setLocalFormats(next);
                setLocalFormatSort('custom');
              }}
              onMoveUp={(i) => moveFormat(i, -1)}
              onMoveDown={(i) => moveFormat(i, 1)}
            />
            {DEFAULT_FORMAT_OPTIONS.filter((f) => !localFormats.includes(f)).length > 0 && (
              <div className="settings-row" style={{ marginTop: 8, gap: 6 }}>
                <select
                  className="settings-select"
                  style={{ flex: 1 }}
                  value=""
                  onChange={(e) => { if (e.target.value) restoreFormat(e.target.value); }}
                >
                  <option value="" disabled>Restore removed format...</option>
                  {DEFAULT_FORMAT_OPTIONS.filter((f) => !localFormats.includes(f)).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <button
                  className="settings-btn"
                  onClick={() => {
                    const missing = DEFAULT_FORMAT_OPTIONS.filter((f) => !localFormats.includes(f));
                    const next = [...localFormats, ...missing];
                    customOrderRef.current = next;
                    setLocalFormats(next);
                    setLocalFormatSort('custom');
                  }}
                >
                  Restore all
                </button>
              </div>
            )}
            <div className="settings-row" style={{ marginTop: 6 }}>
              <input
                className="settings-input"
                value={newFormat}
                onChange={(e) => setNewFormat(e.target.value)}
                placeholder="Add custom format..."
                onKeyDown={(e) => e.key === 'Enter' && addFormat()}
              />
              <button className="settings-btn" onClick={addFormat}>Add</button>
            </div>
          </div>

          {/* Comparison colors */}
          <div className="settings-section">
            <div className="settings-section-title">Comparison colors</div>
            <div className="settings-section-desc">Colors used in the Compare diff view. Click a swatch to pick a color.</div>
            <ColorSwatch
              label="Added"
              value={addedColor}
              onChange={(c) => { setAddedColor(c); applyComparisonColors(c, deletedColor, changedColor); }}
            />
            <ColorSwatch
              label="Deleted"
              value={deletedColor}
              onChange={(c) => { setDeletedColor(c); applyComparisonColors(addedColor, c, changedColor); }}
            />
            <ColorSwatch
              label="Changed"
              value={changedColor}
              onChange={(c) => { setChangedColor(c); applyComparisonColors(addedColor, deletedColor, c); }}
            />
            <button
              className="comparison-colors-reset"
              onClick={() => {
                const d = { added: '#4caf50', deleted: '#f44336', changed: '#ff9800' };
                setAddedColor(d.added);
                setDeletedColor(d.deleted);
                setChangedColor(d.changed);
                applyComparisonColors(d.added, d.deleted, d.changed);
              }}
            >
              Reset to defaults
            </button>
          </div>

          {/* Storage */}
          <div className="settings-section">
            <div className="settings-section-title">Storage</div>
            <div className="settings-section-desc">Location where your notes and settings are saved.</div>
            <div className="settings-row">
              <span className="settings-label">Data folder</span>
              <input
                className="settings-input"
                readOnly
                value={dataPath || 'Resolving...'}
                style={{ fontSize: 11, color: 'var(--text-secondary)', cursor: 'default' }}
              />
              <button className="settings-btn" onClick={openDataFolder} style={{ flexShrink: 0 }}>Open</button>
            </div>
          </div>

          {/* About */}
          <div className="settings-section">
            <div className="settings-section-title">About</div>
            <div className="settings-section-desc">Application information and version.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <img
                src="/icon.png"
                width={64}
                height={64}
                alt="AI Transparent Notes icon"
                style={{ borderRadius: 14, flexShrink: 0 }}
              />
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>AI Transparent Notes v2</div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
                  A modern cross-platform notes app with AI assistance
                </div>
                <div style={{ color: 'var(--subtle-text)', fontSize: 11 }}>
                  {appVersion ? `Version ${appVersion}` : 'Version 0.1.0'}
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="settings-btn" onClick={resetToDefaults} style={{ marginRight: 'auto' }}>
            Reset to defaults
          </button>
          <button className="settings-btn" onClick={handleCancel}>Cancel</button>
          <button className="settings-btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
