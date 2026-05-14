import { useEffect, ReactNode } from 'react';
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

  useEffect(() => {
    void getCurrentWindow().setAlwaysOnTop(settings.alwaysOnTop);
  }, [settings.alwaysOnTop]);

  // Set native window background transparent once so CSS opacity shows desktop through
  useEffect(() => {
    void getCurrentWindow().setBackgroundColor('#00000000');
  }, []);

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
    const newIndex = notes.length;
    setActiveNoteIndex(newIndex);
    if (!settings.paneNoteIds[0]) {
      setPaneNoteId(0, note.id);
    }
  }

  const items = settings.mainToolbarItems ?? [
    'pin', 'theme', 'font', 'size', 'opacity', 'layout', 'workspace', 'import', 'focus', 'settings',
  ];

  const renderedItems = items.map((key, i) => {
    switch (key) {
      case 'pin':
        return (
          <button
            key={`pin-${i}`}
            className={`toolbar-btn${settings.alwaysOnTop ? ' active' : ''}`}
            onClick={() => setAlwaysOnTop(!settings.alwaysOnTop)}
            title="Always on top"
          >
            {settings.alwaysOnTop ? '📌' : '📍'}
          </button>
        );
      case 'theme':
        return (
          <select
            key={`theme-${i}`}
            className="toolbar-select"
            value={settings.theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            title="Theme"
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        );
      case 'font':
        return (
          <select
            key={`font-${i}`}
            className="toolbar-select"
            value={settings.fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            title="Font"
          >
            {['Segoe UI', 'Consolas', 'Cascadia Code', 'Courier New', 'Georgia',
              'Times New Roman', 'Calibri', 'Arial', 'Verdana', 'Tahoma',
              'Trebuchet MS', 'Comic Sans MS'].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        );
      case 'size':
        return (
          <select
            key={`size-${i}`}
            className="toolbar-select"
            value={settings.fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            title="Font size"
            style={{ width: 54 }}
          >
            {[10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        );
      case 'opacity':
        return (
          <span key={`opacity-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
              onInput={(e) => setWindowOpacity(Number((e.target as HTMLInputElement).value))}
              onChange={(e) => setWindowOpacity(Number(e.target.value))}
              title="Opacity"
            />
          </span>
        );
      case 'layout':
        return (
          <select
            key={`layout-${i}`}
            className="toolbar-select"
            value={settings.layout}
            onChange={(e) => setLayout(e.target.value as Layout)}
            title="Layout"
          >
            {LAYOUTS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        );
      case 'workspace':
        return (
          <button
            key={`workspace-${i}`}
            className={`toolbar-btn${settings.workspacePanelVisible ? ' active' : ''}`}
            onClick={() => setWorkspacePanelVisible(!settings.workspacePanelVisible)}
            title="Workspace files"
          >
            Files
          </button>
        );
      case 'import':
        return (
          <button key={`import-${i}`} className="toolbar-btn" onClick={handleImport} title="Import file">
            Import
          </button>
        );
      case 'focus':
        return (
          <button
            key={`focus-${i}`}
            className={`toolbar-btn${focusMode ? ' active' : ''}`}
            onClick={() => setFocusMode(!focusMode)}
            title="Focus mode"
          >
            Focus
          </button>
        );
      case 'settings':
        return (
          <button key={`settings-${i}`} className="toolbar-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            Settings
          </button>
        );
      default:
        return null;
    }
  });

  // Insert separators between groups of items
  const withSeps: ReactNode[] = [];
  renderedItems.forEach((item, i) => {
    if (i > 0) withSeps.push(<div key={`sep-${i}`} className="toolbar-sep" />);
    withSeps.push(item);
  });

  return <div className="toolbar">{withSeps}</div>;
}
