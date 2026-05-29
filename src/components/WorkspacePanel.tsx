import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { readDir, readTextFile, watch, UnwatchFn } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
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
  isRoot: boolean;
}

// ─── Tree item ────────────────────────────────────────────────────────────────

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'py') return '🐍';
  if (ext === 'js' || ext === 'mjs') return '📜';
  if (ext === 'ts' || ext === 'tsx') return '📘';
  if (ext === 'rs') return '🦀';
  if (ext === 'md') return '📄';
  if (ext === 'json') return '🗂';
  if (ext === 'html' || ext === 'htm') return '🌐';
  if (ext === 'css' || ext === 'scss') return '🎨';
  if (ext === 'sql') return '🗃';
  if (ext === 'java') return '☕';
  if (ext === 'cpp' || ext === 'c' || ext === 'h') return '⚙';
  return '📃';
}

interface TreeItemProps {
  entry: WorkspaceEntry;
  depth: number;
  selectedPath: string | null;
  locatePath: string | null;
  flashPath: string | null;
  forceExpand: number;
  forceCollapse: number;
  onOpen: (entry: WorkspaceEntry) => void;
  onHighlight: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: WorkspaceEntry, isRoot: boolean) => void;
  onFileHover: (e: React.MouseEvent, path: string) => void;
  onFileHoverEnd: () => void;
  rootPath: string;
}

function TreeItem({
  entry, depth, selectedPath, locatePath, flashPath,
  forceExpand, forceCollapse,
  onOpen, onHighlight, onContextMenu, onFileHover, onFileHoverEnd, rootPath,
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

  const isRoot = entry.path === rootPath;
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
        style={{ paddingLeft: 8 + depth * 14 }}
        data-locate-path={entry.path}
        data-tree-type={entry.isDirectory ? 'dir' : 'file'}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, entry, isRoot);
        }}
        onMouseEnter={(e) => { if (!entry.isDirectory) onFileHover(e, entry.path); }}
        onMouseLeave={() => { if (!entry.isDirectory) onFileHoverEnd(); }}
      >
        {entry.isDirectory ? (
          <span style={{ fontSize: 11, color: 'var(--subtle-text)', pointerEvents: 'none' }}>
            {expanded ? '▾' : '▸'}
          </span>
        ) : null}
        <span style={{ pointerEvents: 'none' }}>
          {entry.isDirectory ? '📁' : fileIcon(entry.name)}
        </span>
        <span className="tree-item-name" style={{ pointerEvents: 'none' }}>
          {entry.name}
        </span>
      </div>

      {entry.isDirectory && expanded && loaded &&
        children.map((child) => (
          <TreeItem
            key={child.path}
            entry={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            locatePath={locatePath}
            flashPath={flashPath}
            forceExpand={forceExpand}
            forceCollapse={forceCollapse}
            onOpen={onOpen}
            onHighlight={onHighlight}
            onContextMenu={onContextMenu}
            onFileHover={onFileHover}
            onFileHoverEnd={onFileHoverEnd}
            rootPath={rootPath}
          />
        ))}
    </>
  );
}

// ─── WorkspacePanel ───────────────────────────────────────────────────────────

export function WorkspacePanel() {
  const { settings, addWorkspaceFolder, removeWorkspaceFolder, setWorkspacePanelWidth } =
    useSettingsStore();
  const { notes } = useNoteStore();
  const { focusedPaneIndex } = useUiStore();
  const setPaneNoteId = useSettingsStore((s) => s.setPaneNoteId);

  const [roots, setRoots] = useState<WorkspaceEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [locatePath, setLocatePath] = useState<string | null>(null);
  const [flashPath, setFlashPath] = useState<string | null>(null);
  const [tooltipMsg, setTooltipMsg] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [forceExpand, setForceExpand] = useState(0);
  const [forceCollapse, setForceCollapse] = useState(0);
  const [filePathTooltip, setFilePathTooltip] = useState<{ path: string; x: number; y: number } | null>(null);

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

  // Watch all workspace roots
  useEffect(() => {
    unwatchRefs.current.forEach((u) => void u());
    unwatchRefs.current = [];

    for (const folder of settings.workspaceFolders) {
      void watch(
        folder,
        () => { setRoots((prev) => [...prev]); },
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

  function openFileInPane(entry: WorkspaceEntry, _newTab: boolean) {
    void handleFileOpen(entry.path);
  }

  function handleSelect(entry: WorkspaceEntry) {
    if (!entry.isDirectory) {
      void handleFileOpen(entry.path);
    }
  }

  function handleContextMenu(e: React.MouseEvent, entry: WorkspaceEntry, isRoot: boolean) {
    setContextMenu({ x: e.clientX, y: e.clientY, entry, isRoot });
  }

  function handleFileHoverStart(e: React.MouseEvent, filePath: string) {
    if (pathTooltipTimerRef.current) clearTimeout(pathTooltipTimerRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pathTooltipTimerRef.current = setTimeout(() => {
      setFilePathTooltip({ path: filePath, x: rect.left, y: rect.bottom + 4 });
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
        contextMenu && setContextMenu(null);
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
      <div className="workspace-tree" ref={treeRef}>
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

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.entry.isDirectory && (
            <>
              <div
                className="context-menu-item"
                onClick={() => openFileInPane(contextMenu.entry, false)}
              >
                Open in active pane
              </div>
              <div
                className="context-menu-item"
                onClick={() => openFileInPane(contextMenu.entry, true)}
              >
                Open in new tab
              </div>
            </>
          )}
          {contextMenu.isRoot && (
            <div
              className="context-menu-item danger"
              onClick={() => {
                removeWorkspaceFolder(contextMenu.entry.path);
                setContextMenu(null);
              }}
            >
              Remove from workspace
            </div>
          )}
        </div>
      )}

      {/* File path tooltip — rendered into document.body to avoid panel overflow clipping */}
      {filePathTooltip && createPortal(
        <div style={{
          position: 'fixed',
          left: filePathTooltip.x,
          top: filePathTooltip.y,
          background: '#1a1a2e',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '4px 8px',
          fontSize: 10,
          color: 'rgba(255,255,255,0.8)',
          fontFamily: 'monospace',
          maxWidth: 400,
          wordBreak: 'break-all',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {filePathTooltip.path}
        </div>,
        document.body
      )}
    </div>
  );
}
