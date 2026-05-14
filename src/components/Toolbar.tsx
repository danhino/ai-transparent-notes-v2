import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useNoteStore } from '../stores/noteStore';
import { readSourceFile } from '../services/storageService';
import { Theme, Layout } from '../types';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'blue', label: 'Blue' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'green', label: 'Green' },
];

const LAYOUTS: { value: Layout; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'side-by-side', label: 'Side by side' },
  { value: 'top-bottom', label: 'Top / bottom' },
  { value: 'grid', label: '2x2 grid' },
];

const FONTS = ['Segoe UI', 'Inter', 'Arial', 'Georgia', 'Verdana', 'Cascadia Code'];
const FONT_SIZES = [11, 12, 13, 14, 15, 16, 18, 20];

export function Toolbar() {
  const {
    settings,
    setTheme,
    setLayout,
    setFontFamily,
    setFontSize,
    setWindowOpacity,
    setAlwaysOnTop,
    setWorkspacePanelVisible,
  } = useSettingsStore();

  const { focusMode, setFocusMode, setSettingsOpen } = useUiStore();
  const { addNote, setActiveNoteIndex, notes } = useNoteStore();
  const setPaneNoteId = useSettingsStore((s) => s.setPaneNoteId);

  // Sync always-on-top with window
  useEffect(() => {
    void getCurrentWindow().setAlwaysOnTop(settings.alwaysOnTop);
  }, [settings.alwaysOnTop]);

  // Apply opacity as CSS on the root (visual effect; native window transparency requires Rust)
  useEffect(() => {
    document.documentElement.style.opacity = String(settings.windowOpacity);
  }, [settings.windowOpacity]);

  async function handleImport() {
    const path = await openDialog({
      multiple: false,
      filters: [{ name: 'Text files', extensions: ['txt', 'md', 'js', 'ts', 'py', 'rs', 'html', 'css', 'json'] }],
    });
    if (!path || typeof path !== 'string') return;
    const content = await readSourceFile(path);
    const parts = path.replace(/\\/g, '/').split('/');
    const name = parts[parts.length - 1];
    const note = addNote({ title: name, content, sourceFilePath: path });
    const newIndex = notes.length; // length before add
    setActiveNoteIndex(newIndex);
    if (!settings.paneNoteIds[0]) {
      setPaneNoteId(0, note.id);
    }
  }

  function togglePin() {
    setAlwaysOnTop(!settings.alwaysOnTop);
  }

  return (
    <div className="toolbar">
      {/* Pin */}
      <button
        className={`toolbar-btn${settings.alwaysOnTop ? ' active' : ''}`}
        onClick={togglePin}
        title="Always on top"
      >
        {settings.alwaysOnTop ? '📌' : '📍'}
      </button>

      <div className="toolbar-sep" />

      {/* Theme */}
      <select
        className="toolbar-select"
        value={settings.theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
        title="Theme"
      >
        {THEMES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {/* Font family */}
      <select
        className="toolbar-select"
        value={settings.fontFamily}
        onChange={(e) => setFontFamily(e.target.value)}
        title="Font"
      >
        {FONTS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      {/* Font size */}
      <select
        className="toolbar-select"
        value={settings.fontSize}
        onChange={(e) => setFontSize(Number(e.target.value))}
        title="Font size"
        style={{ width: 54 }}
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <div className="toolbar-sep" />

      {/* Opacity */}
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {Math.round(settings.windowOpacity * 100)}%
      </span>
      <input
        type="range"
        className="opacity-slider"
        min={0.2}
        max={1}
        step={0.05}
        value={settings.windowOpacity}
        onChange={(e) => setWindowOpacity(Number(e.target.value))}
        title="Opacity"
      />

      <div className="toolbar-sep" />

      {/* Layout */}
      <select
        className="toolbar-select"
        value={settings.layout}
        onChange={(e) => setLayout(e.target.value as Layout)}
        title="Layout"
      >
        {LAYOUTS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>

      <div className="toolbar-sep" />

      {/* Files toggle */}
      <button
        className={`toolbar-btn${settings.workspacePanelVisible ? ' active' : ''}`}
        onClick={() => setWorkspacePanelVisible(!settings.workspacePanelVisible)}
        title="Workspace files"
      >
        Files
      </button>

      {/* Import */}
      <button className="toolbar-btn" onClick={handleImport} title="Import file">
        Import
      </button>

      <div className="toolbar-sep" />

      {/* Focus mode */}
      <button
        className={`toolbar-btn${focusMode ? ' active' : ''}`}
        onClick={() => setFocusMode(!focusMode)}
        title="Focus mode"
      >
        Focus
      </button>

      {/* Settings */}
      <button className="toolbar-btn" onClick={() => setSettingsOpen(true)} title="Settings">
        Settings
      </button>
    </div>
  );
}
