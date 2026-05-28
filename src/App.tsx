import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { listen } from '@tauri-apps/api/event';
import { platform as getPlatform } from '@tauri-apps/plugin-os';
import { TitleBar } from './components/TitleBar';
import { Toolbar } from './components/Toolbar';
import { TabBar } from './components/TabBar';
import { PaneSystem } from './components/PaneSystem';
import { WorkspacePanel } from './components/WorkspacePanel';

const SettingsDialog = lazy(() => import('./components/SettingsDialog').then((m) => ({ default: m.SettingsDialog })));
const CompareDialog = lazy(() => import('./components/CompareDialog').then((m) => ({ default: m.CompareDialog })));
import { useNoteStore } from './stores/noteStore';
import { useSettingsStore } from './stores/settingsStore';
import { useUiStore } from './stores/uiStore';
import { loadSettings, saveSettings } from './services/storageService';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(settings: Parameters<typeof saveSettings>[0]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveSettings(settings), 800);
}

export default function App() {
  const { notes, addNote, setActiveNoteIndex, setNotes } = useNoteStore();
  const { settings, setSettings, setPaneNoteId, update } = useSettingsStore();
  const { focusMode, setFocusMode, settingsOpen, compareOpen, setPlatform } = useUiStore();

  type PanelPos = { x: number; y: number; w: number; h: number };
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const isDragging = useRef(false);

  // ─── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const p = await getPlatform();
        setPlatform(p === 'macos' ? 'macos' : p === 'linux' ? 'linux' : 'windows');
      } catch {
        setPlatform('windows');
      }

      const saved = await loadSettings();
      setSettings(saved);
      setNotes(saved.notes);
      setActiveNoteIndex(saved.activeNoteIndex ?? 0);
      setFocusMode(saved.focusMode ?? false);

      if (saved.notes.length === 0) {
        const note = addNote();
        setPaneNoteId(0, note.id);
      } else {
        if (!saved.paneNoteIds[0] && saved.notes.length > 0) {
          setPaneNoteId(0, saved.notes[0].id);
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tray "New note" ─────────────────────────────────────────────────────────
  useEffect(() => {
    const p = listen('tray-new-note', () => {
      const { notes: n } = useNoteStore.getState();
      const { settings: s } = useSettingsStore.getState();
      if (n.length >= 8) return;
      const note = addNote();
      setActiveNoteIndex(n.length);
      const emptyPane = s.paneNoteIds.findIndex((id) => !id);
      setPaneNoteId(emptyPane >= 0 ? emptyPane : 0, note.id);
    });
    return () => void p.then((fn) => fn());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Escape exits focus mode ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) setFocusMode(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusMode, setFocusMode]);

  // ─── Persist focus mode to settings so it restores on next launch ─────────────
  useEffect(() => {
    update({ focusMode });
  }, [focusMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Persist settings ────────────────────────────────────────────────────────
  useEffect(() => {
    scheduleSave({
      ...settings,
      notes,
      activeNoteIndex: useNoteStore.getState().activeNoteIndex,
    });
  }, [settings, notes]);

  // ─── Apply font CSS vars ─────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--editor-font', `'${settings.fontFamily}', monospace`);
    root.style.fontFamily = `'${settings.fontFamily}', system-ui, sans-serif`;
    root.style.fontSize = `${settings.fontSize}px`;
  }, [settings.fontFamily, settings.fontSize]);

  // ─── Reset panel position when focus mode exits ───────────────────────────────
  useEffect(() => {
    if (!focusMode) setPanelPos(null);
  }, [focusMode]);

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const panel = document.querySelector('.main-area') as HTMLElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    isDragging.current = true;

    function onMove(ev: MouseEvent) {
      const newX = Math.max(0, Math.min(ev.clientX - offsetX, window.innerWidth - w));
      const newY = Math.max(0, Math.min(ev.clientY - offsetY, window.innerHeight - h));
      setPanelPos({ x: newX, y: newY, w, h });
    }
    function onUp() {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    const panel = document.querySelector('.main-area') as HTMLElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    isDragging.current = true;

    function onMove(ev: TouchEvent) {
      ev.preventDefault();
      const t = ev.touches[0];
      const newX = Math.max(0, Math.min(t.clientX - offsetX, window.innerWidth - w));
      const newY = Math.max(0, Math.min(t.clientY - offsetY, window.innerHeight - h));
      setPanelPos({ x: newX, y: newY, w, h });
    }
    function onEnd() {
      isDragging.current = false;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    }
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  return (
    <div className={`app${focusMode ? ' focus-mode' : ''}`} data-theme={settings.theme}>
      {focusMode && (
        <div className="focus-controls">
          <button
            className="focus-exit-btn"
            onClick={() => setFocusMode(false)}
            title="Exit focus mode (Esc)"
          >
            Exit focus
          </button>
          <button
            className="focus-drag-btn"
            onMouseDown={handleDragStart}
            onTouchStart={handleTouchStart}
            title="Drag to move"
          >
            ⠿
          </button>
        </div>
      )}

      <TitleBar />
      <Toolbar />
      <TabBar />

      <div
        className="main-area"
        style={focusMode && panelPos ? {
          position: 'fixed',
          left: panelPos.x,
          top: panelPos.y,
          right: 'auto',
          bottom: 'auto',
          width: panelPos.w,
          height: panelPos.h,
        } : undefined}
      >
        {settings.workspacePanelVisible && <WorkspacePanel />}
        <PaneSystem />
      </div>

      <Suspense fallback={null}>
        {settingsOpen && <SettingsDialog />}
      </Suspense>
      <Suspense fallback={null}>
        {compareOpen && <CompareDialog />}
      </Suspense>
    </div>
  );
}
