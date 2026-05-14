import { useState, useEffect, useCallback, useRef } from 'react';
import { readDir, readTextFile, watch, UnwatchFn } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
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
  onOpen: (entry: WorkspaceEntry) => void;
  onHighlight: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: WorkspaceEntry, isRoot: boolean) => void;
  rootPath: string;
}

function TreeItem({ entry, depth, selectedPath, onOpen, onHighlight, onContextMenu, rootPath }: TreeItemProps) {
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

  const isRoot = entry.path === rootPath;

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
      console.log('[WorkspacePanel] dblclick', entry.path);
      onOpen(entry);
    }
  }

  return (
    <>
      <div
        className={`tree-item${selectedPath === entry.path ? ' selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, entry, isRoot);
        }}
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
            onOpen={onOpen}
            onHighlight={onHighlight}
            onContextMenu={onContextMenu}
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const unwatchRefs = useRef<UnwatchFn[]>([]);

  // Build root entries from stored folder paths — normalize to forward slashes
  // so child paths built with `${root}/${name}` don't get mixed separators on Windows
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
    // Unwatch previous
    unwatchRefs.current.forEach((u) => void u());
    unwatchRefs.current = [];

    for (const folder of settings.workspaceFolders) {
      void watch(
        folder,
        () => {
          // Force re-render of roots to trigger tree refresh
          setRoots((prev) => [...prev]);
        },
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

  // Drag-and-drop folder
  useEffect(() => {
    async function handleDrop(e: DragEvent) {
      e.preventDefault();
      const items = e.dataTransfer?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // Path isn't available from webkitGetAsEntry on Tauri; use dialog fallback
        }
      }
    }
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', (e) => e.preventDefault());
    return () => window.removeEventListener('drop', handleDrop);
  }, []);

  async function addFolder() {
    const path = await openDialog({ directory: true, multiple: false });
    if (path && typeof path === 'string') {
      addWorkspaceFolder(path);
    }
  }

  const handleFileOpen = async (filePath: string) => {
    try {
      console.log('Opening file:', filePath);
      const content = await readTextFile(filePath);
      console.log('Content read, length:', content.length);
      const note = useNoteStore.getState().openWorkspaceFile(content, filePath);
      if (note) {
        setPaneNoteId(focusedPaneIndex, note.id);
        setSelectedPath(filePath.replace(/\\/g, '/'));
        setContextMenu(null);
      } else {
        console.warn('[WorkspacePanel] max 4 notes reached, cannot open file');
      }
    } catch (err) {
      console.error('Failed to read file:', err);
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
    if (note?.sourceFilePath) {
      setSelectedPath(note.sourceFilePath);
    }
  }, [settings.paneNoteIds, focusedPaneIndex, notes]);

  return (
    <div
      className="workspace-panel"
      style={{ width: settings.workspacePanelWidth }}
      onClick={() => contextMenu && setContextMenu(null)}
    >
      {/* Toolbar */}
      <div className="workspace-toolbar">
        <button className="toolbar-btn" onClick={addFolder} title="Add folder">
          + Folder
        </button>
        <button className="toolbar-btn" onClick={locateCurrent} title="Locate current file">
          Locate
        </button>
      </div>

      {/* Tree */}
      <div className="workspace-tree">
        {roots.length === 0 && (
          <div className="workspace-drop-zone">
            Drop a folder here or click &ldquo;+ Folder&rdquo;
          </div>
        )}
        {roots.map((root) => (
          <TreeItem
            key={root.path}
            entry={root}
            depth={0}
            selectedPath={selectedPath}
            onOpen={handleSelect}
            onHighlight={setSelectedPath}
            onContextMenu={handleContextMenu}
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
    </div>
  );
}
