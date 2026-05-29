import { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { NoteEditor, NoteEditorRef } from './NoteEditor';
import { RichTextEditor, RichTextEditorRef } from './RichTextEditor';
import { AIToolbar } from './AIToolbar';
import { RtfToolbar } from './RtfToolbar';
import { CsvToolbar } from './CsvToolbar';
import { XmlToolbar } from './XmlToolbar';
import { JsonToolbar } from './JsonToolbar';
import { SqlToolbar } from './SqlToolbar';
import { MarkdownToolbar } from './MarkdownToolbar';
import { PythonToolbar } from './PythonToolbar';
import { JsToolbar } from './JsToolbar';
import { CSharpToolbar } from './CSharpToolbar';
import { ShellToolbar } from './ShellToolbar';
import { JavaToolbar } from './JavaToolbar';
import { CppToolbar } from './CppToolbar';
import { PlainTextToolbar } from './PlainTextToolbar';
import { RustToolbar } from './RustToolbar';
import { HtmlCssToolbar } from './HtmlCssToolbar';
import { CsvTableView } from './CsvTableView';
const AiResultDialog = lazy(() => import('./AiResultDialog').then((m) => ({ default: m.AiResultDialog })));
import { StatusBar } from './StatusBar';
import { useNoteStore } from '../stores/noteStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { runAction, runApply, getAiErrorMessage } from '../services/aiService';
import { writeSourceFile } from '../services/storageService';
import { rtfToHtml, htmlToRtf, stripHtmlTags } from '../utils/rtfParser';
import { stripHtml } from '../utils/textUtils';
import { getDelimiterChar } from '../utils/csvParser';
import type { Delimiter } from '../types';

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
  'RTF': '.rtf',
  'CSV': '.csv',
  'XML': '.xml',
};

const ACTION_LABELS: Record<string, string> = {
  fix: 'Fix',
  polish: 'Polish',
  rephrase: 'Rephrase',
  convo: 'Convo',
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
  const editorRef     = useRef<NoteEditorRef>(null);
  const richEditorRef = useRef<RichTextEditorRef>(null);
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);

  const { notes, updateNote, markSaved, unsavedIds, setNoteFormat } = useNoteStore();
  const { settings } = useSettingsStore();
  const setPaneNoteId = useSettingsStore((s) => s.setPaneNoteId);
  const setPaneLineNumbers = useSettingsStore((s) => s.setPaneLineNumbers);
  const {
    focusMode,
    focusedPaneIndex,
    paneStates,
    platform,
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

  const [selectedFormat, setSelectedFormat] = useState(note?.format ?? settings.formatOptions[0] ?? 'Auto-detect (Code)');
  const [toolbarCollapsed, setToolbarCollapsed] = useState(() => window.innerWidth < 768);
  const [lineNumber, setLineNumber] = useState(1);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [paneError, setPaneError] = useState<string | null>(null);
  const [aiDialogData, setAiDialogData] = useState<AiDialogData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CSV-specific state
  const [showCsvTableView, setShowCsvTableView] = useState(false);
  const [csvHasHeader, setCsvHasHeader] = useState(false);
  const [csvDelimiter, setCsvDelimiter] = useState<Delimiter>('Comma');
  const [csvFilterText] = useState('');

  useEffect(() => {
    const content = note?.content ?? '';
    setCharCount(content.length);
    setWordCount(content.trim() ? content.trim().split(/\s+/).length : 0);
  }, [note?.content]);

  // Sync format selector when the note displayed in this pane changes
  useEffect(() => {
    if (note?.format) {
      setSelectedFormat(note.format);
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Auto-enable table view when format switches to CSV
  useEffect(() => {
    if (selectedFormat === 'CSV') setShowCsvTableView(true);
  }, [selectedFormat]);

  // Ctrl/Cmd+Shift+T toggles toolbar collapse for the focused pane
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!isFocused) return;
      const mod = platform === 'macos' ? e.metaKey : e.ctrlKey;
      if (mod && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setToolbarCollapsed((v) => !v);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFocused, platform]);

  // Ctrl/Cmd+S triggers immediate save on the focused pane
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!isFocused) return;
      const mod = platform === 'macos' ? e.metaKey : e.ctrlKey;
      if (mod && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        if (isUnsaved && !isSaving) void handleSaveNow();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFocused, platform, isUnsaved, isSaving]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // content is HTML when editing in RTF mode; convert back to RTF for the file
        const writeContent =
          selectedFormat === 'RTF' && n.sourceFilePath.toLowerCase().endsWith('.rtf')
            ? htmlToRtf(content)
            : content;
        await writeSourceFile(n.sourceFilePath, writeContent);
      } catch {
        // ignore write errors
      }
    }
    markSaved(id);
    setPaneSavedVisible(paneIndex, true);
    setTimeout(() => setPaneSavedVisible(paneIndex, false), 1500);
  }

  async function handleSaveNow() {
    if (!note || !isUnsaved || isSaving) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setIsSaving(true);
    const currentContent =
      selectedFormat === 'RTF'
        ? (richEditorRef.current?.getHTML() ?? note.content)
        : (editorRef.current?.getText() ?? note.content);
    await Promise.all([
      savePersist(note.id, currentContent),
      new Promise<void>((r) => setTimeout(r, 300)),
    ]);
    setIsSaving(false);
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

    let text: string;
    if (isRtf) {
      const html = richEditorRef.current?.getHTML() ?? note.content;
      text = ext === '.rtf' ? htmlToRtf(html) : stripHtmlTags(html);
    } else {
      text = editorRef.current?.getText() ?? note.content;
    }

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
    if (isRtf) {
      const re = richEditorRef.current;
      if (!re) return note?.content ?? '';
      // getText() returns innerText — plain text without HTML tags
      if (re.hasSelection()) return re.getSelection();
      return re.getText();
    }
    const view = editorRef.current;
    if (!view) return note?.content ?? '';
    if (view.hasSelection()) return view.getSelection();
    return view.getText();
  }

  // For RTF notes, getWorkingText already returns plain text (innerText).
  // For other formats, return the content as-is.
  function getAiText(): string {
    return getWorkingText();
  }

  const handleAction = useCallback(
    async (action: 'fix' | 'polish' | 'rephrase' | 'convo' | 'spellcheck' | 'suggest' | 'apply' | 'compare') => {
      if (!note || paneState.isBusy) return;

      if (action === 'compare') {
        useUiStore.getState().setCompareOpen(true);
        return;
      }

      const wasSelection = editorRef.current?.hasSelection() ?? false;
      const text = getAiText();
      if (!text.trim()) return;

      setPaneBusy(paneIndex, true);
      try {
        if (action === 'apply') {
          const format = selectedFormat;

          if (format === 'HTML Viewer') {
            await invoke('open_html_preview', { html: text, opacity: settings.windowOpacity });
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

    if (isRtf) {
      // AI result is plain text; convert to basic HTML for the rich text editor
      const htmlResult = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      let post: string;
      if (wasSelection) {
        const fullHtml = richEditorRef.current?.getHTML() ?? note.content;
        // Try to replace the matching plain-text span inside the HTML
        const escapedOriginal = original
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        post = fullHtml.includes(escapedOriginal)
          ? fullHtml.replace(escapedOriginal, htmlResult)
          : htmlResult;
      } else {
        post = htmlResult;
      }

      richEditorRef.current?.setContent(post);
      updateNote(note.id, { content: post });
      if (detectedLanguage) setPaneDetectedLanguage(paneIndex, detectedLanguage);
      setAiDialogData(null);
      void savePersist(note.id, post);
      return;
    }

    // Non-RTF path (CodeMirror)
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
  const isRtf        = selectedFormat === 'RTF';
  const isCsv        = selectedFormat === 'CSV';
  const isXml        = selectedFormat === 'XML';
  const isJson       = selectedFormat === 'JSON';
  const isSql        = selectedFormat === 'SQL';
  const isMarkdown   = selectedFormat === 'Markdown';
  const isPython     = selectedFormat === 'Python';
  const isJs         = selectedFormat === 'JavaScript' || selectedFormat === 'TypeScript';
  const isCsharp     = selectedFormat === 'C#';
  const isShell      = selectedFormat === 'Bash' || selectedFormat === 'PowerShell';
  const isJava       = selectedFormat === 'Java';
  const isCpp        = selectedFormat === 'C' || selectedFormat === 'C++';
  const isPlainText  = selectedFormat === 'Plain Text (Structured Notes)' || selectedFormat === 'Plain text';
  const isRust       = selectedFormat === 'Rust';
  const isHtmlCss    = selectedFormat === 'HTML/CSS';

  // For RTF notes: parse raw RTF to HTML once, then pass HTML on subsequent edits.
  // useMemo re-runs only when content or isRtf changes.
  const rtfHtmlContent = useMemo(() => {
    if (!isRtf) return '';
    // If the content was already converted to HTML (has been edited this session),
    // pass it through directly. Otherwise parse from raw RTF.
    if (content.trim().startsWith('{\\rtf') || !content.trim().startsWith('<')) {
      return rtfToHtml(content);
    }
    return content;
  }, [isRtf, content]); // eslint-disable-line react-hooks/exhaustive-deps

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

        {/* CSV table view toggle */}
        {isCsv && (
          <button
            className={`pane-icon-btn${showCsvTableView ? ' active-subtle' : ''}`}
            onClick={() => setShowCsvTableView((v) => !v)}
            title="Toggle table view"
            style={{ fontSize: 10 }}
          >
            ⊞
          </button>
        )}

        <div style={{ flex: 1 }} />

        {note && (
          <button
            type="button"
            className={
              isSaving ? 'pane-save-btn saving'
              : isUnsaved ? 'pane-save-btn unsaved'
              : 'pane-save-btn saved'
            }
            onClick={isUnsaved && !isSaving ? () => void handleSaveNow() : undefined}
            title={isSaving ? 'Saving...' : isUnsaved ? 'Click to save (Ctrl+S)' : 'All changes saved'}
          >
            {isSaving ? 'Saving...' : isUnsaved ? '↓ Save' : 'Saved'}
          </button>
        )}
      </div>

      {/* Toolbar area: collapse toggle + AI/contextual toolbars */}
      <div className={`toolbar-area${toolbarCollapsed ? ' collapsed' : ''}`}>
        <button
          className="toolbar-toggle"
          onClick={() => setToolbarCollapsed((v) => !v)}
          title={toolbarCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
        >
          {toolbarCollapsed ? '›' : '‹'}
        </button>
        <div className={`toolbar-rows${toolbarCollapsed ? ' collapsed' : ''}`}>
          <AIToolbar
            disabled={paneState.isBusy || !note}
            selectedFormat={selectedFormat}
            onFormatChange={(fmt) => {
              if (note) {
                // Switching away from RTF (or any format that stored HTML in note.content):
                // extract plain text before handing the content to CodeMirror.
                const hasHtmlContent =
                  selectedFormat === 'RTF' ||
                  content.includes('&lt;') ||
                  content.includes('&amp;');
                if (hasHtmlContent) {
                  const cleanText =
                    selectedFormat === 'RTF' && richEditorRef.current
                      ? richEditorRef.current.getText()
                      : stripHtml(content);
                  updateNote(note.id, { content: cleanText });
                }
                setNoteFormat(note.id, fmt);
              }
              setSelectedFormat(fmt);
              setPaneDetectedLanguage(paneIndex, null);
            }}
            onAction={handleAction}
          />

          {/* Contextual toolbar — RTF */}
          {isRtf && (
            <RtfToolbar
              editorRef={richEditorRef}
              disabled={paneState.isBusy || !note}
            />
          )}

          {/* Contextual toolbar — CSV */}
          {isCsv && (
            <CsvToolbar
              editorRef={editorRef}
              disabled={paneState.isBusy || !note}
              hasHeader={csvHasHeader}
              delimiter={csvDelimiter}
              onHasHeaderChange={setCsvHasHeader}
              onDelimiterChange={setCsvDelimiter}
            />
          )}

          {/* Contextual toolbar — XML */}
          {isXml && (
            <XmlToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} />
          )}
          {/* Contextual toolbar — JSON */}
          {isJson && (
            <JsonToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} />
          )}
          {/* Contextual toolbar — SQL */}
          {isSql && (
            <SqlToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} />
          )}
          {/* Contextual toolbar — Markdown */}
          {isMarkdown && (
            <MarkdownToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} />
          )}
          {/* Contextual toolbar — Python */}
          {isPython && (
            <PythonToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} />
          )}
          {/* Contextual toolbar — JavaScript / TypeScript */}
          {isJs && (
            <JsToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} format={selectedFormat} />
          )}
          {/* Contextual toolbar — C# */}
          {isCsharp && (
            <CSharpToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} />
          )}
          {/* Contextual toolbar — Bash / PowerShell */}
          {isShell && (
            <ShellToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} format={selectedFormat} />
          )}
          {/* Contextual toolbar — Java */}
          {isJava && (
            <JavaToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} />
          )}
          {/* Contextual toolbar — C / C++ */}
          {isCpp && (
            <CppToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} format={selectedFormat} />
          )}
          {/* Contextual toolbar — Plain Text */}
          {isPlainText && (
            <PlainTextToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} />
          )}
          {/* Contextual toolbar — Rust */}
          {isRust && (
            <RustToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} />
          )}
          {/* Contextual toolbar — HTML/CSS */}
          {isHtmlCss && (
            <HtmlCssToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} />
          )}
        </div>
      </div>

      {/* Editor area — split view when CSV table is active */}
      <div className={`editor-area${isCsv && showCsvTableView ? ' editor-area-split' : ''}`}>
        {isRtf ? (
          <RichTextEditor
            ref={richEditorRef}
            htmlContent={rtfHtmlContent}
            fontFamily={settings.fontFamily}
            fontSize={settings.fontSize}
            onChange={handleEditorChange}
          />
        ) : (
          <NoteEditor
            ref={editorRef}
            content={content}
            fontFamily={settings.fontFamily}
            fontSize={settings.fontSize}
            language={paneState.detectedLanguage ?? selectedFormat}
            activeTheme={settings.theme}
            showLineNumbers={showLineNumbers}
            onChange={handleEditorChange}
            onLineChange={setLineNumber}
          />
        )}

        {isCsv && showCsvTableView && (
          <CsvTableView
            content={content}
            delimiter={getDelimiterChar(csvDelimiter)}
            hasHeader={csvHasHeader}
            filterText={csvFilterText}
          />
        )}
      </div>

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
      <Suspense fallback={null}>
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
      </Suspense>
    </div>
  );
}
