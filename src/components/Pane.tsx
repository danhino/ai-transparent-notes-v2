import { useRef, useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { NoteEditor, NoteEditorRef } from './NoteEditor';
import { AIToolbar } from './AIToolbar';
import { AiResultDialog } from './AiResultDialog';
import { StatusBar } from './StatusBar';
import { useNoteStore } from '../stores/noteStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { runAction, runApply, getAiErrorMessage } from '../services/aiService';
import { writeSourceFile } from '../services/storageService';

const SAVE_DEBOUNCE_MS = 400;

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
  'HTML Viewer': '.html',
  'PowerShell': '.ps1',
  'Bash': '.sh',
  'JSON': '.json',
};

const ACTION_LABELS: Record<string, string> = {
  fix: 'Fix',
  polish: 'Polish',
  rephrase: 'Rephrase',
  spellcheck: 'Spell check',
  suggest: 'Suggest',
  apply: 'Apply',
};

function formatToExt(format: string): string {
  return FORMAT_EXT[format] ?? '.txt';
}

interface AiDialogData {
  actionName: string;
  original: string;
  result: string;
  wasSelection: boolean;
  detectedLanguage: string | null;
}

interface Props {
  paneIndex: number;
}

export function Pane({ paneIndex }: Props) {
  const editorRef = useRef<NoteEditorRef>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);

  const { notes, updateNote, markSaved, unsavedIds } = useNoteStore();
  const { settings } = useSettingsStore();
  const setPaneNoteId = useSettingsStore((s) => s.setPaneNoteId);
  const setPaneLineNumbers = useSettingsStore((s) => s.setPaneLineNumbers);
  const {
    focusMode,
    focusedPaneIndex,
    paneStates,
    setFocusedPane,
    setFocusMode,
    setPaneBusy,
    setPaneDetectedLanguage,
    setPaneSavedVisible,
  } = useUiStore();

  const noteId = settings.paneNoteIds[paneIndex] ?? null;
  const note = notes.find((n) => n.id === noteId) ?? null;
  const paneState = paneStates[paneIndex];
  const isFocused = focusedPaneIndex === paneIndex;
  const isUnsaved = note != null && unsavedIds.has(note.id);
  const showLineNumbers = settings.paneLineNumbers?.[paneIndex] ?? settings.showLineNumbersByDefault ?? true;

  const [selectedFormat, setSelectedFormat] = useState(settings.formatOptions[0] ?? 'Plain text');
  const [htmlPreviewUrl, setHtmlPreviewUrl] = useState<string | null>(null);
  const [lineNumber, setLineNumber] = useState(1);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [paneError, setPaneError] = useState<string | null>(null);
  const [aiDialogData, setAiDialogData] = useState<AiDialogData | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const content = note?.content ?? '';
    setCharCount(content.length);
    setWordCount(content.trim() ? content.trim().split(/\s+/).length : 0);
  }, [note?.content]);

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

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  function handleEditorChange(text: string) {
    if (!note) return;
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

  const handleAction = useCallback(
    async (action: 'fix' | 'polish' | 'rephrase' | 'spellcheck' | 'suggest' | 'apply' | 'compare') => {
      if (!note || paneState.isBusy) return;

      if (action === 'compare') {
        useUiStore.getState().setCompareOpen(true);
        return;
      }

      const wasSelection = editorRef.current?.hasSelection() ?? false;
      const text = getWorkingText();
      if (!text.trim()) return;

      setPaneBusy(paneIndex, true);
      try {
        if (action === 'apply') {
          const format = selectedFormat;

          if (format === 'HTML Viewer') {
            const url = await invoke<string>('open_html_preview', { html: text });
            setHtmlPreviewUrl(url);
            return;
          }

          const { result, detectedLanguage } = await runApply(text, format, settings);
          setAiDialogData({
            actionName: ACTION_LABELS[action] ?? action,
            original: text,
            result,
            wasSelection,
            detectedLanguage: detectedLanguage ?? null,
          });
        } else {
          const result = await runAction(action, text, settings);
          setAiDialogData({
            actionName: ACTION_LABELS[action] ?? action,
            original: text,
            result,
            wasSelection,
            detectedLanguage: null,
          });
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

  function applyAiResult() {
    if (!aiDialogData || !note) return;
    const { original, result, wasSelection, detectedLanguage } = aiDialogData;
    const view = editorRef.current;

    let post: string;
    if (wasSelection) {
      const fullText = view?.getText() ?? note.content;
      post = fullText.replace(original, result);
    } else {
      post = result;
    }

    if (view) view.applyText(post);
    updateNote(note.id, { content: post });
    if (detectedLanguage) setPaneDetectedLanguage(paneIndex, detectedLanguage);
    setAiDialogData(null);
    void savePersist(note.id, post);
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
              <option key={n.id} value={n.id}>{n.title}</option>
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

        {/* Line numbers toggle */}
        <button
          className={`pane-icon-btn${showLineNumbers ? ' active-subtle' : ''}`}
          onClick={() => setPaneLineNumbers(paneIndex, !showLineNumbers)}
          title="Toggle line numbers"
          style={{ fontSize: 11, fontWeight: 600, fontFamily: 'monospace' }}
        >
          #
        </button>

        {/* Open HTML preview in browser */}
        {htmlPreviewUrl && (
          <button
            className="pane-icon-btn"
            onClick={() => void openUrl(htmlPreviewUrl)}
            title="Open HTML preview in browser"
            style={{ fontSize: 12 }}
          >
            ↗
          </button>
        )}

        <div style={{ flex: 1 }} />

        {note && (
          <span className={isUnsaved ? 'pane-unsaved' : 'pane-saved'}>
            {isUnsaved ? '● Unsaved' : 'Saved'}
          </span>
        )}
      </div>

      {/* AI toolbar */}
      <AIToolbar
        disabled={paneState.isBusy || !note}
        selectedFormat={selectedFormat}
        onFormatChange={(fmt) => {
          setSelectedFormat(fmt);
          setPaneDetectedLanguage(paneIndex, null);
        }}
        onAction={handleAction}
      />

      {/* Editor */}
      <NoteEditor
        ref={editorRef}
        content={content}
        fontFamily={settings.fontFamily}
        fontSize={settings.fontSize}
        detectedLanguage={paneState.detectedLanguage}
        showLineNumbers={showLineNumbers}
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
        <div
          className="error-banner"
          onClick={() => {
            setPaneError(null);
            if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
          }}
        >
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

      {/* AI result dialog */}
      {aiDialogData && (
        <AiResultDialog
          actionName={aiDialogData.actionName}
          original={aiDialogData.original}
          result={aiDialogData.result}
          settings={settings}
          onApply={applyAiResult}
          onClose={() => setAiDialogData(null)}
        />
      )}
    </div>
  );
}
