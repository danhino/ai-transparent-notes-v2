import { useRef, useState, useEffect, useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { NoteEditor, NoteEditorRef } from './NoteEditor';
import { AIToolbar } from './AIToolbar';
import { DiffBanner } from './DiffBanner';
import { StatusBar } from './StatusBar';
import { useNoteStore } from '../stores/noteStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { computeLineDiff } from '../services/diffService';
import { runAction, runApply, getAiErrorMessage } from '../services/aiService';
import { writeSourceFile } from '../services/storageService';

const SAVE_DEBOUNCE_MS = 400;
const DIFF_SECONDS = 30;
const DIFF_ADDED_COLOR = 'rgba(40,200,100,0.25)';
const DIFF_DELETED_COLOR = 'rgba(220,60,60,0.3)';

const FORMAT_EXT: Record<string, string> = {
  'Markdown': '.md',
  'Python': '.py',
  'JavaScript': '.js',
  'TypeScript': '.ts',
  'Java': '.java',
  'C#': '.cs',
  'C': '.c',
  'C++': '.cpp',
  'SQL': '.sql',
  'HTML/CSS': '.html',
  'PowerShell': '.ps1',
  'Bash': '.sh',
  'JSON': '.json',
};

function formatToExt(format: string): string {
  return FORMAT_EXT[format] ?? '.txt';
}

interface Props {
  paneIndex: number;
}

export function Pane({ paneIndex }: Props) {
  const editorRef = useRef<NoteEditorRef>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diffTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);

  const { notes, updateNote, markSaved, unsavedIds } = useNoteStore();
  const { settings } = useSettingsStore();
  const setPaneNoteId = useSettingsStore((s) => s.setPaneNoteId);
  const {
    focusMode,
    focusedPaneIndex,
    paneStates,
    setFocusedPane,
    setFocusMode,
    setPaneBusy,
    setPaneDetectedLanguage,
    setPaneDiff,
    tickPaneDiffCountdown,
    setPaneSavedVisible,
  } = useUiStore();

  const noteId = settings.paneNoteIds[paneIndex] ?? null;
  const note = notes.find((n) => n.id === noteId) ?? null;
  const paneState = paneStates[paneIndex];
  const isFocused = focusedPaneIndex === paneIndex;
  const isUnsaved = note != null && unsavedIds.has(note.id);

  const [selectedFormat, setSelectedFormat] = useState(settings.formatOptions[0] ?? 'Plain text');
  const [lineNumber, setLineNumber] = useState(1);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [paneError, setPaneError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const content = note?.content ?? '';
    setCharCount(content.length);
    setWordCount(content.trim() ? content.trim().split(/\s+/).length : 0);
  }, [note?.content]);

  useEffect(() => {
    return () => {
      if (diffTimerRef.current) clearInterval(diffTimerRef.current);
    };
  }, [noteId]);

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  useEffect(() => {
    if (!showExportMenu) return;
    function handleOutside(e: MouseEvent) {
      if (exportContainerRef.current && !exportContainerRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showExportMenu]);

  function startDiffCountdown() {
    if (diffTimerRef.current) clearInterval(diffTimerRef.current);
    diffTimerRef.current = setInterval(() => {
      tickPaneDiffCountdown(paneIndex);
    }, 1000);
  }

  function stopDiffCountdown() {
    if (diffTimerRef.current) {
      clearInterval(diffTimerRef.current);
      diffTimerRef.current = null;
    }
  }

  useEffect(() => {
    if (paneState.diff === null) {
      stopDiffCountdown();
    }
  }, [paneState.diff]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleEditorChange(text: string) {
    if (!note) return;
    if (paneState.diff) {
      acceptDiff();
    }
    updateNote(note.id, { content: text });
    setCharCount(text.length);
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void savePersist(note.id, text);
    }, SAVE_DEBOUNCE_MS);
  }

  async function savePersist(id: string, content: string) {
    const n = useNoteStore.getState().notes.find((x) => x.id === id);
    if (n?.sourceFilePath) {
      try {
        await writeSourceFile(n.sourceFilePath, content);
      } catch {
        // ignore write errors
      }
    }
    markSaved(id);
    setPaneSavedVisible(paneIndex, true);
    setTimeout(() => setPaneSavedVisible(paneIndex, false), 1500);
  }

  function startRename() {
    if (!note) return;
    setRenameValue(note.title);
    setIsRenaming(true);
  }

  function commitRename() {
    setIsRenaming(false);
    const trimmed = renameValue.trim();
    if (!note || !trimmed) return;
    updateNote(note.id, { title: trimmed });
  }

  async function exportNote(ext: string) {
    setShowExportMenu(false);
    if (!note) return;
    const text = editorRef.current?.getText() ?? note.content;
    const baseName = note.title.replace(/\.[^.]+$/, '');
    const savePath = await save({
      defaultPath: `${baseName}${ext}`,
      filters: [{ name: 'All files', extensions: [ext.replace('.', '')] }],
    });
    if (!savePath || typeof savePath !== 'string') return;
    try {
      await writeTextFile(savePath, text);
    } catch (err) {
      console.error('[Pane] Export failed:', err);
    }
  }

  function showError(msg: string) {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setPaneError(msg);
    errorTimerRef.current = setTimeout(() => setPaneError(null), 8000);
  }

  function getWorkingText(): string {
    const view = editorRef.current;
    if (!view) return note?.content ?? '';
    if (view.hasSelection()) return view.getSelection();
    return view.getText();
  }

  function replaceWithResult(original: string, result: string, wasSelection: boolean) {
    const view = editorRef.current;
    if (!view || !note) return;
    const pre = wasSelection ? view.getText() : original;
    const post = wasSelection
      ? view.getText().replace(original, result)
      : result;
    const blocks = computeLineDiff(pre, post);
    view.applyDiff(post, blocks, DIFF_ADDED_COLOR, DIFF_DELETED_COLOR);
    updateNote(note.id, { content: post });
    setPaneDiff(paneIndex, {
      preSnapshot: pre,
      postSnapshot: post,
      diffBlocks: blocks,
      countdown: DIFF_SECONDS,
    });
    startDiffCountdown();
  }

  const handleAction = useCallback(
    async (action: 'fix' | 'polish' | 'rephrase' | 'spellcheck' | 'suggest' | 'apply' | 'compare' | 'autodetect') => {
      if (!note || paneState.isBusy) return;

      if (action === 'compare') {
        useUiStore.getState().setCompareOpen(true);
        return;
      }

      const wasSelection = editorRef.current?.hasSelection() ?? false;
      const text = getWorkingText();
      if (!text.trim()) return;

      console.log(`[Pane ${paneIndex}] action=${action} content_len=${text.length}`);

      setPaneBusy(paneIndex, true);
      try {
        if (action === 'apply' || action === 'autodetect') {
          const format = action === 'autodetect' ? 'Auto-detect (Code)' : selectedFormat;
          const { result, detectedLanguage } = await runApply(text, format, settings);
          replaceWithResult(text, result, wasSelection);
          if (detectedLanguage) {
            setPaneDetectedLanguage(paneIndex, detectedLanguage);
          }
        } else {
          const result = await runAction(action, text, settings);
          replaceWithResult(text, result, wasSelection);
        }
      } catch (err) {
        console.error('AI action failed:', err);
        showError(getAiErrorMessage(err));
      } finally {
        setPaneBusy(paneIndex, false);
      }
    },
    [note, paneState.isBusy, selectedFormat, settings, paneIndex] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function acceptDiff() {
    stopDiffCountdown();
    setPaneDiff(paneIndex, null);
    editorRef.current?.clearDiff();
  }

  function revertDiff() {
    if (!paneState.diff || !note) return;
    stopDiffCountdown();
    const pre = paneState.diff.preSnapshot;
    editorRef.current?.applyText(pre);
    updateNote(note.id, { content: pre });
    setPaneDiff(paneIndex, null);
    editorRef.current?.clearDiff();
  }

  const formatExt = formatToExt(selectedFormat);
  const exportOptions = [
    { label: 'Export as .txt', ext: '.txt' },
    { label: 'Export as .md', ext: '.md' },
  ];
  if (formatExt !== '.txt' && formatExt !== '.md') {
    exportOptions.push({ label: `Export as ${formatExt}`, ext: formatExt });
  }

  const content = note?.content ?? '';

  return (
    <div
      className={`pane${isFocused ? ' focused' : ''}`}
      onClick={() => setFocusedPane(paneIndex)}
      onDoubleClick={() => { if (focusMode) setFocusMode(false); }}
    >
      {/* Note selector header */}
      <div className="pane-header">
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="pane-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              else if (e.key === 'Escape') setIsRenaming(false);
            }}
            onBlur={commitRename}
          />
        ) : (
          <select
            className="pane-note-select"
            value={noteId ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setPaneNoteId(paneIndex, val || null);
            }}
          >
            <option value="">-- no note --</option>
            {notes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        )}

        <button
          className="pane-icon-btn"
          onClick={startRename}
          disabled={!note}
          title="Rename note"
        >
          ✏
        </button>

        <div ref={exportContainerRef} style={{ position: 'relative' }}>
          <button
            className="pane-icon-btn"
            onClick={() => setShowExportMenu((v) => !v)}
            disabled={!note}
            title="Export note"
          >
            ↓
          </button>
          {showExportMenu && (
            <div className="export-menu">
              {exportOptions.map((opt) => (
                <button
                  key={opt.ext}
                  className="export-menu-item"
                  onClick={() => void exportNote(opt.ext)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {note && (
          <span className={isUnsaved ? 'pane-unsaved' : 'pane-saved'}>
            {isUnsaved ? '● Unsaved' : 'Saved'}
          </span>
        )}
      </div>

      {/* AI toolbar */}
      <AIToolbar
        paneIndex={paneIndex}
        disabled={paneState.isBusy || !note}
        selectedFormat={selectedFormat}
        onFormatChange={(fmt) => {
          setSelectedFormat(fmt);
          setPaneDetectedLanguage(paneIndex, null);
        }}
        onAction={handleAction}
      />

      {/* Diff banner */}
      {paneState.diff && (
        <DiffBanner diff={paneState.diff} onAccept={acceptDiff} onRevert={revertDiff} />
      )}

      {/* Editor */}
      <NoteEditor
        ref={editorRef}
        content={content}
        fontFamily={settings.fontFamily}
        fontSize={settings.fontSize}
        detectedLanguage={paneState.detectedLanguage}
        onChange={handleEditorChange}
        onLineChange={setLineNumber}
      />

      {/* Busy overlay */}
      {paneState.isBusy && (
        <div className="busy-overlay">
          <div className="spinner" />
        </div>
      )}

      {/* Error banner */}
      {paneError && (
        <div className="error-banner" onClick={() => { setPaneError(null); if (errorTimerRef.current) clearTimeout(errorTimerRef.current); }}>
          <span>⚠ {paneError}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7 }}>Click to dismiss</span>
        </div>
      )}

      {/* Status bar */}
      <StatusBar
        charCount={charCount}
        wordCount={wordCount}
        lineNumber={lineNumber}
        detectedLanguage={paneState.detectedLanguage}
      />
    </div>
  );
}
