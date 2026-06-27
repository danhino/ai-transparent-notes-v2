import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { readDir, readTextFile, watch, UnwatchFn } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { open as openWithSystem } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { FolderPlus, ChevronsUpDown, ChevronsDownUp, Crosshair, FolderOpen } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { useNoteStore } from '../stores/noteStore';
import { useUiStore } from '../stores/uiStore';
import { WorkspaceEntry } from '../types';

// ─── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  entry: WorkspaceEntry;
  rootPath: string;
}

// ─── Tree item ────────────────────────────────────────────────────────────────

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  // Protected — do not change
  if (ext === 'py') return '🐍';
  if (ext === 'js' || ext === 'mjs') return '📜';
  if (ext === 'ts' || ext === 'tsx') return '📘';
  if (ext === 'html' || ext === 'htm') return '🌐';
  if (ext === 'java') return '☕';
  // Documents
  if (ext === 'md' || ext === 'mdx') return '📝';
  if (ext === 'txt' || ext === 'rtf') return '📄';
  if (ext === 'pdf') return '📕';
  if (ext === 'log') return '🪵';
  // Data / config
  if (ext === 'csv') return '📊';
  if (ext === 'json') return '🔧';
  if (ext === 'xml') return '📋';
  if (ext === 'yaml' || ext === 'yml') return '⚙️';
  if (ext === 'toml') return '🔩';
  if (ext === 'ini' || ext === 'cfg' || ext === 'conf') return '🔩';
  if (ext === 'env') return '🔐';
  // Styling
  if (ext === 'css') return '🎨';
  if (ext === 'scss' || ext === 'sass') return '🎨';
  // Database
  if (ext === 'sql') return '🗄️';
  if (ext === 'db' || ext === 'sqlite' || ext === 'sqlite3') return '🗄️';
  // Shell / scripting
  if (ext === 'sh' || ext === 'bash') return '🖥️';
  if (ext === 'ps1') return '💠';
  if (ext === 'bat' || ext === 'cmd') return '⬛';
  // Systems languages
  if (ext === 'c' || ext === 'h') return '🔵';
  if (ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'hpp') return '🔷';
  if (ext === 'cs') return '🟣';
  if (ext === 'rs') return '🦀';
  if (ext === 'go') return '🐹';
  // Other languages
  if (ext === 'rb') return '💎';
  if (ext === 'php') return '🐘';
  if (ext === 'swift') return '🍎';
  if (ext === 'kt' || ext === 'kts') return '🟠';
  if (ext === 'r') return '📈';
  if (ext === 'lua') return '🌙';
  // Binary / executable
  if (ext === 'exe' || ext === 'msi') return '🔨';
  if (ext === 'dll') return '🔌';
  // Media
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) return '🖼️';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return '🎬';
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) return '🎵';
  // Archives
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext)) return '📦';
  return '📄';
}

interface TreeItemProps {
  entry: WorkspaceEntry;
  depth: number;
  selectedPath: string | null;
  locatePath: string | null;
  flashPath: string | null;
  forceExpand: number;
  forceCollapse: number;
  refreshVersion: number;
  onOpen: (entry: WorkspaceEntry) => void;
  onHighlight: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: WorkspaceEntry, rootPath: string) => void;
  onFileHover: (e: React.MouseEvent, path: string) => void;
  onFileHoverEnd: () => void;
  rootPath: string;
  isLastChild?: boolean;
}

function TreeItem({
  entry, depth, selectedPath, locatePath, flashPath,
  forceExpand, forceCollapse, refreshVersion,
  onOpen, onHighlight, onContextMenu, onFileHover, onFileHoverEnd,
  rootPath,
  isLastChild = false,
}: TreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<WorkspaceEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function loadChildren() {
    try {
      const entries = await readDir(entry.path);
      const items: WorkspaceEntry[] = entries
        .map((e) => ({
          name: e.name ?? '',
          path: `${entry.path}/${e.name}`,
          isDirectory: e.isDirectory ?? false,
        }))
        .filter((e) => e.name && !e.name.startsWith('.'))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      setChildren(items);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }

  // Auto-expand this directory when it is an ancestor of the locate target
  useEffect(() => {
    if (!locatePath || !entry.isDirectory) return;
    if (locatePath.startsWith(entry.path + '/') || locatePath === entry.path) {
      setExpanded(true);
      if (!loaded) void loadChildren();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locatePath, entry.path, entry.isDirectory]);

  // Expand all — cascade: when this node expands it renders children with same forceExpand > 0
  useEffect(() => {
    if (forceExpand > 0 && entry.isDirectory) {
      setExpanded(true);
      if (!loaded) void loadChildren();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceExpand]);

  // Collapse all
  useEffect(() => {
    if (forceCollapse > 0) setExpanded(false);
  }, [forceCollapse]);

  // Reload children when files are created/deleted/renamed in this folder
  useEffect(() => {
    if (!entry.isDirectory || !expanded || !loaded) return;
    void loadChildren();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshVersion]);

  const isFlashing = flashPath === entry.path;

  function handleClick() {
    if (entry.isDirectory) {
      const next = !expanded;
      setExpanded(next);
      if (next && !loaded) void loadChildren();
    } else {
      onHighlight(entry.path);
    }
  }

  function handleDoubleClick() {
    if (!entry.isDirectory) {
      onOpen(entry);
    }
  }

  return (
    <>
      <div
        className={`tree-item${selectedPath === entry.path ? ' selected' : ''}${isFlashing ? ' locate-flash' : ''}`}
        style={{ paddingLeft: 2 + depth * 30 }}
        data-locate-path={entry.path}
        data-tree-type={entry.isDirectory ? 'dir' : 'file'}
        data-depth={depth}
        data-is-last-child={isLastChild}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, entry, rootPath);
        }}
        onMouseEnter={(e) => { if (!entry.isDirectory) onFileHover(e, entry.path); }}
        onMouseLeave={() => { if (!entry.isDirectory) onFileHoverEnd(); }}
      >
        {entry.isDirectory ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', pointerEvents: 'none' }}>
            {expanded ? '▾' : '▸'}
          </span>
        ) : null}
        <span style={{ pointerEvents: 'none', verticalAlign: 'middle' }}>
          {entry.isDirectory ? '📁' : fileIcon(entry.name)}
        </span>
        <span className="tree-item-name" style={{ pointerEvents: 'none' }}>
          {entry.name}
        </span>
      </div>

      {entry.isDirectory && expanded && loaded &&
        children.map((child, idx) => (
          <TreeItem
            key={child.path}
            entry={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            locatePath={locatePath}
            flashPath={flashPath}
            forceExpand={forceExpand}
            forceCollapse={forceCollapse}
            refreshVersion={refreshVersion}
            onOpen={onOpen}
            onHighlight={onHighlight}
            onContextMenu={onContextMenu}
            onFileHover={onFileHover}
            onFileHoverEnd={onFileHoverEnd}
            rootPath={rootPath}
            isLastChild={idx === children.length - 1}
          />
        ))}
    </>
  );
}

// ─── WorkspacePanel ───────────────────────────────────────────────────────────

export function WorkspacePanel() {
  const settings              = useSettingsStore((s) => s.settings);
  const addWorkspaceFolder    = useSettingsStore((s) => s.addWorkspaceFolder);
  const removeWorkspaceFolder = useSettingsStore((s) => s.removeWorkspaceFolder);
  const setWorkspacePanelWidth = useSettingsStore((s) => s.setWorkspacePanelWidth);
  const setPaneNoteId         = useSettingsStore((s) => s.setPaneNoteId);

  const notes          = useNoteStore((s) => s.notes);
  const focusedPaneIndex = useUiStore((s) => s.focusedPaneIndex);

  const [roots, setRoots] = useState<WorkspaceEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [locatePath, setLocatePath] = useState<string | null>(null);
  const [flashPath, setFlashPath] = useState<string | null>(null);
  const [tooltipMsg, setTooltipMsg] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [forceExpand, setForceExpand] = useState(0);
  const [forceCollapse, setForceCollapse] = useState(0);
  const [filePathTooltip, setFilePathTooltip] = useState<{ path: string; x: number; y: number } | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const unwatchRefs = useRef<UnwatchFn[]>([]);
  const treeRef = useRef<HTMLDivElement>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      if (pathTooltipTimerRef.current) clearTimeout(pathTooltipTimerRef.current);
    };
  }, []);

  // Dismiss context menu on Escape
  useEffect(() => {
    if (!contextMenu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contextMenu]);

  // Build root entries — normalize to forward slashes
  useEffect(() => {
    setRoots(
      settings.workspaceFolders.map((p) => {
        const normalized = p.replace(/\\/g, '/');
        const parts = normalized.split('/');
        return { name: parts[parts.length - 1], path: normalized, isDirectory: true };
      })
    );
  }, [settings.workspaceFolders]);

  // Watch all workspace roots — trigger refresh on file changes
  useEffect(() => {
    unwatchRefs.current.forEach((u) => void u());
    unwatchRefs.current = [];

    for (const folder of settings.workspaceFolders) {
      void watch(
        folder,
        () => { setRefreshVersion((v) => v + 1); },
        { recursive: true }
      ).then((unwatch) => {
        unwatchRefs.current.push(unwatch);
      });
    }

    return () => {
      unwatchRefs.current.forEach((u) => void u());
      unwatchRefs.current = [];
    };
  }, [settings.workspaceFolders]);

  function showTooltip(msg: string) {
    setTooltipMsg(msg);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => setTooltipMsg(null), 3000);
  }

  async function addFolder() {
    const path = await openDialog({ directory: true, multiple: false });
    if (path && typeof path === 'string') {
      addWorkspaceFolder(path);
    }
  }

  const handleFileOpen = async (filePath: string) => {
    try {
      const content = await readTextFile(filePath);
      const note = useNoteStore.getState().openWorkspaceFile(content, filePath);
      if (note) {
        setPaneNoteId(focusedPaneIndex, note.id);
        setSelectedPath(filePath.replace(/\\/g, '/'));
        setContextMenu(null);
      }
    } catch (err) {
      console.error('[WorkspacePanel] Failed to read file:', err);
    }
  };

  function handleSelect(entry: WorkspaceEntry) {
    if (!entry.isDirectory) {
      void handleFileOpen(entry.path);
    }
  }

  function handleContextMenu(e: React.MouseEvent, entry: WorkspaceEntry, rootPath: string) {
    // Estimate menu dimensions to keep within screen
    const menuW = 190;
    const menuH = entry.isDirectory ? 235 : 300;
    const x = e.clientX + menuW > window.innerWidth ? e.clientX - menuW : e.clientX;
    const y = e.clientY + menuH > window.innerHeight ? e.clientY - menuH : e.clientY;
    setContextMenu({ x, y, entry, rootPath });
  }

  function handleFileHoverStart(e: React.MouseEvent, filePath: string) {
    if (pathTooltipTimerRef.current) clearTimeout(pathTooltipTimerRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pathTooltipTimerRef.current = setTimeout(() => {
      const tooltipWidth = 320;
      const x = rect.right + 12 + tooltipWidth > window.innerWidth
        ? rect.left - tooltipWidth - 12
        : rect.right + 12;
      const y = rect.top + rect.height / 2 - 12;
      setFilePathTooltip({ path: filePath, x, y });
    }, 500);
  }

  function handleFileHoverEnd() {
    if (pathTooltipTimerRef.current) clearTimeout(pathTooltipTimerRef.current);
    setFilePathTooltip(null);
  }

  async function revealInExplorer() {
    if (!selectedPath) return;
    try {
      await invoke('reveal_in_explorer', { path: selectedPath });
    } catch (err) {
      console.error('[WorkspacePanel] reveal_in_explorer failed:', err);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showTooltip(label);
    } catch {
      // clipboard unavailable
    }
  }

  async function openFolderInExplorer(folderPath: string) {
    try {
      await openWithSystem(folderPath);
    } catch (err) {
      console.error('[WorkspacePanel] openFolderInExplorer failed:', err);
    }
  }

  async function openTerminalAt(path: string) {
    try {
      await invoke('open_terminal_at', { path });
    } catch (err) {
      console.error('[WorkspacePanel] openTerminalAt failed:', err);
    }
  }

  async function runBySystem(filePath: string) {
    try {
      await openWithSystem(filePath);
    } catch (err) {
      console.error('[WorkspacePanel] runBySystem failed:', err);
    }
  }

  // Resize
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(settings.workspacePanelWidth);

  function handleResizeStart(e: React.MouseEvent) {
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = settings.workspacePanelWidth;

    function onMove(ev: MouseEvent) {
      if (!resizingRef.current) return;
      const delta = ev.clientX - startXRef.current;
      const newWidth = Math.max(140, Math.min(480, startWRef.current + delta));
      setWorkspacePanelWidth(newWidth);
    }
    function onUp() {
      resizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const locateCurrent = useCallback(() => {
    const paneNoteId = settings.paneNoteIds[focusedPaneIndex];
    const note = notes.find((n) => n.id === paneNoteId);

    if (!note?.sourceFilePath) {
      showTooltip('No file to locate — this is a scratch note');
      return;
    }

    const normalized = note.sourceFilePath.replace(/\\/g, '/');

    const inWorkspace = roots.some(
      (r) => normalized === r.path || normalized.startsWith(r.path + '/')
    );
    if (!inWorkspace) {
      showTooltip('File is not in the current workspace');
      return;
    }

    setSelectedPath(normalized);
    setLocatePath(normalized);

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashPath(normalized);
    flashTimerRef.current = setTimeout(() => setFlashPath(null), 2000);

    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const el = treeRef.current?.querySelector(
        `[data-locate-path="${CSS.escape(normalized)}"]`
      );
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setLocatePath(null);
    }, 350);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.paneNoteIds, focusedPaneIndex, notes, roots]);

  return (
    <div
      className="workspace-panel"
      style={{ width: settings.workspacePanelWidth }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.workspace-toolbar')) {
          if (!target.closest('[data-tree-type="file"]')) {
            setSelectedPath(null);
          }
        }
        filePathTooltip && setFilePathTooltip(null);
      }}
    >
      {/* Toolbar */}
      <div className="workspace-toolbar">
        <button className="ws-icon-btn" onClick={addFolder} title="Add folder">
          <FolderPlus size={14} strokeWidth={1.5} />
        </button>
        <button
          className="ws-icon-btn"
          onClick={() => setForceExpand((v) => v + 1)}
          title="Expand all"
        >
          <ChevronsUpDown size={14} strokeWidth={1.5} />
        </button>
        <button
          className="ws-icon-btn"
          onClick={() => setForceCollapse((v) => v + 1)}
          title="Collapse all"
        >
          <ChevronsDownUp size={14} strokeWidth={1.5} />
        </button>
        <div style={{ position: 'relative' }}>
          <button className="ws-icon-btn" onClick={locateCurrent} title="Locate current file">
            <Crosshair size={14} strokeWidth={1.5} />
          </button>
          {tooltipMsg && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 300,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
              fontSize: 11,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
            }}>
              {tooltipMsg}
            </div>
          )}
        </div>
        <button
          className="ws-icon-btn"
          onClick={revealInExplorer}
          disabled={!selectedPath}
          title="Open in Explorer"
        >
          <FolderOpen size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Tree */}
      <div
        className="workspace-tree"
        ref={treeRef}
        onScroll={() => contextMenu && setContextMenu(null)}
      >
        {roots.length === 0 && (
          <div className="workspace-drop-zone">
            Drop a folder here or click + to add one
          </div>
        )}
        {roots.map((root) => (
          <TreeItem
            key={root.path}
            entry={root}
            depth={0}
            selectedPath={selectedPath}
            locatePath={locatePath}
            flashPath={flashPath}
            forceExpand={forceExpand}
            forceCollapse={forceCollapse}
            refreshVersion={refreshVersion}
            onOpen={handleSelect}
            onHighlight={setSelectedPath}
            onContextMenu={handleContextMenu}
            onFileHover={handleFileHoverStart}
            onFileHoverEnd={handleFileHoverEnd}
            rootPath={root.path}
          />
        ))}
      </div>

      {/* Resize handle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 4,
          height: '100%',
          cursor: 'col-resize',
        }}
        onMouseDown={handleResizeStart}
      />

      {/* Context menu — portal to body so it renders above all panels */}
      {contextMenu && createPortal(
        <>
          {/* Invisible overlay catches outside clicks */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onMouseDown={() => setContextMenu(null)}
          />
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {contextMenu.entry.isDirectory ? (
              /* ── Folder menu ── */
              <>
                <div className="context-menu-item" onClick={() => { void copyToClipboard(contextMenu.entry.path, 'Path copied'); setContextMenu(null); }}>
                  Copy path
                </div>
                <div className="context-menu-sep" />
                <div className="context-menu-item" onClick={() => { showTooltip('Find in Files coming soon'); setContextMenu(null); }}>
                  Find in Files...
                </div>
                <div className="context-menu-sep" />
                <div className="context-menu-item" onClick={() => { void openFolderInExplorer(contextMenu.entry.path); setContextMenu(null); }}>
                  Explorer here
                </div>
                <div className="context-menu-item" onClick={() => { void openTerminalAt(contextMenu.entry.path); setContextMenu(null); }}>
                  CMD here
                </div>
                <div className="context-menu-sep" />
                <div className="context-menu-item danger" onClick={() => { removeWorkspaceFolder(contextMenu.rootPath); setContextMenu(null); }}>
                  Remove from workspace
                </div>
              </>
            ) : (
              /* ── File menu ── */
              <>
                <div className="context-menu-item" onClick={() => { void handleFileOpen(contextMenu.entry.path); setContextMenu(null); }}>
                  Open
                </div>
                <div className="context-menu-sep" />
                <div className="context-menu-item" onClick={() => { void copyToClipboard(contextMenu.entry.path, 'Path copied'); setContextMenu(null); }}>
                  Copy path
                </div>
                <div className="context-menu-item" onClick={() => { void copyToClipboard(contextMenu.entry.name, 'File name copied'); setContextMenu(null); }}>
                  Copy file name
                </div>
                <div className="context-menu-sep" />
                <div className="context-menu-item" onClick={() => { void runBySystem(contextMenu.entry.path); setContextMenu(null); }}>
                  Run by system
                </div>
                <div className="context-menu-sep" />
                <div className="context-menu-item" onClick={() => { void invoke('reveal_in_explorer', { path: contextMenu.entry.path }); setContextMenu(null); }}>
                  Explorer here
                </div>
                <div className="context-menu-item" onClick={() => {
                  const folder = contextMenu.entry.path.split('/').slice(0, -1).join('/');
                  void openTerminalAt(folder);
                  setContextMenu(null);
                }}>
                  CMD here
                </div>
                <div className="context-menu-sep" />
                <div className="context-menu-item danger" onClick={() => { removeWorkspaceFolder(contextMenu.rootPath); setContextMenu(null); }}>
                  Remove from workspace
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* File path tooltip — portal to body to avoid panel overflow clipping */}
      {filePathTooltip && createPortal(
        <div style={{
          position: 'fixed',
          left: filePathTooltip.x,
          top: filePathTooltip.y,
          background: '#1a1a2e',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '5px 8px',
          fontSize: 10,
          color: 'rgba(255,255,255,0.85)',
          fontFamily: 'monospace',
          maxWidth: 320,
          wordBreak: 'break-all',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          {filePathTooltip.path}
        </div>,
        document.body
      )}
    </div>
  );
}
