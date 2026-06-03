import { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useResizable } from '../hooks/useResizable';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { NoteEditor, NoteEditorRef } from './NoteEditor';
import { AIToolbar } from './AIToolbar';
import { RtfToolbar } from './RtfToolbar';
import { CsvToolbar } from './CsvToolbar';
import { XmlToolbar } from './XmlToolbar';
import { JsonToolbar } from './JsonToolbar';
import { SqlToolbar } from './SqlToolbar';
import { MarkdownToolbar } from './MarkdownToolbar';
import { JsonTreeView } from './JsonTreeView';
import { marked } from 'marked';
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
import {
  rtfToHtml, htmlToRtf, stripHtmlTags,
} from '../utils/rtfParser';
import { getDelimiterChar } from '../utils/csvParser';
import type { Delimiter } from '../types';

const SAVE_DEBOUNCE_MS = 400;

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
}

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
  'Rust': '.rs',
  'CSS': '.css',
  'Go': '.go',
  'INI / Config': '.ini',
  'Log': '.log',
  'YAML / ENV': '.yaml',
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

// ─── WYSIWYG RTF editor (contenteditable) ────────────────────────────────────

interface RtfEditorProps {
  htmlContent: string;
  fontFamily: string;
  fontSize: number;
  onChange: (html: string) => void;
  editorRef: React.MutableRefObject<HTMLDivElement | null>;
}

function RtfEditor({ htmlContent, fontFamily, fontSize, onChange, editorRef }: RtfEditorProps) {
  useEffect(() => {
    const div = editorRef.current;
    if (!div) return;
    if (document.activeElement === div) return; // don't reset while the user is typing
    if (div.innerHTML !== htmlContent) {
      div.innerHTML = htmlContent;
    }
  }, [htmlContent, editorRef]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
      className="rtf-editor editor-wrap"
      style={{ fontFamily, fontSize: `${fontSize}px` }}
      spellCheck
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function Pane({ paneIndex }: Props) {
  const editorRef    = useRef<NoteEditorRef>(null);
  const rtfEditorRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [selLabel, setSelLabel] = useState<string | null>(null);
  const [showInvisibles, setShowInvisibles] = useState(() => localStorage.getItem('show-invisibles') === 'true');
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

  // Inline preview state
  const [markdownPreviewOpen, setMarkdownPreviewOpen] = useState(false);
  const [mdPreviewHtml, setMdPreviewHtml] = useState('');
  const [htmlPreviewOpen, setHtmlPreviewOpen] = useState(false);
  const [jsonPreviewOpen, setJsonPreviewOpen] = useState(false);
  const mdPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const htmlPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const htmlIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Preview resize state
  const [previewHeight, setPreviewHeight] = useState(200);
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const isDraggingPreviewRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);
  const editorAreaRef = useRef<HTMLDivElement | null>(null);

  const { width: noteTitleWidth, wrapperRef: noteTitleWrapperRef, isDraggingState: noteTitleDragging, onResizerMouseDown: onNoteTitleResizerMouseDown } =
    useResizable('note-title-width', 160, 80, 350);

  const lineEnding = useMemo(() => {
    const c = note?.content ?? '';
    const sample = c.length > 4096 ? c.slice(0, 4096) : c;
    if (sample.includes('\r\n')) return 'Windows (CR LF)';
    if (sample.includes('\r')) return 'Mac (CR)';
    return 'Unix (LF)';
  }, [note?.content]);

  const handleToggleInvisibles = useCallback(() => {
    setShowInvisibles((prev) => {
      const next = !prev;
      localStorage.setItem('show-invisibles', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const content = note?.content ?? '';
    setCharCount(content.length);
    setWordCount(content.trim() ? content.trim().split(/\s+/).length : 0);
  }, [note?.content]);

  // Sync format, close previews when the note displayed in this pane changes
  useEffect(() => {
    setSelectedFormat(note?.format ?? settings.formatOptions[0] ?? 'Auto-detect (Code)');
    setMarkdownPreviewOpen(false);
    setHtmlPreviewOpen(false);
    setJsonPreviewOpen(false);
    setSelLabel(null);
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
      if (mdPreviewTimerRef.current) clearTimeout(mdPreviewTimerRef.current);
      if (htmlPreviewTimerRef.current) clearTimeout(htmlPreviewTimerRef.current);
    };
  }, []);

  // Auto-enable table view when format switches to CSV
  useEffect(() => {
    if (selectedFormat === 'CSV') setShowCsvTableView(true);
  }, [selectedFormat]);

  // Close inline previews when format changes away from their format
  useEffect(() => {
    if (selectedFormat !== 'Markdown') setMarkdownPreviewOpen(false);
    if (selectedFormat !== 'HTML/CSS') setHtmlPreviewOpen(false);
    if (selectedFormat !== 'JSON') setJsonPreviewOpen(false);
  }, [selectedFormat]);

  // Debounced Markdown → HTML rendering (400ms)
  useEffect(() => {
    if (!markdownPreviewOpen || selectedFormat !== 'Markdown') return;
    const raw = note?.content ?? '';
    if (mdPreviewTimerRef.current) clearTimeout(mdPreviewTimerRef.current);
    mdPreviewTimerRef.current = setTimeout(() => {
      setMdPreviewHtml(sanitizeHtml(marked.parse(raw) as string));
    }, 400);
    return () => { if (mdPreviewTimerRef.current) clearTimeout(mdPreviewTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.content, markdownPreviewOpen, selectedFormat]);

  // Debounced HTML → iframe write (400ms)
  useEffect(() => {
    if (!htmlPreviewOpen || selectedFormat !== 'HTML/CSS') return;
    const raw = note?.content ?? '';
    if (htmlPreviewTimerRef.current) clearTimeout(htmlPreviewTimerRef.current);
    htmlPreviewTimerRef.current = setTimeout(() => {
      const iframe = htmlIframeRef.current;
      if (!iframe) return;
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc.open(); doc.write(raw); doc.close();
    }, 400);
    return () => { if (htmlPreviewTimerRef.current) clearTimeout(htmlPreviewTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.content, htmlPreviewOpen, selectedFormat]);

  // Reset preview height when the note changes
  useEffect(() => { setPreviewHeight(200); }, [noteId]);

  // Preview drag-to-resize mouse events
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingPreviewRef.current) return;
      const delta = dragStartYRef.current - e.clientY;
      const containerH = editorAreaRef.current?.clientHeight ?? 400;
      const next = Math.max(80, Math.min(containerH - 80, dragStartHeightRef.current + delta));
      setPreviewHeight(next);
    }
    function onMouseUp() {
      if (isDraggingPreviewRef.current) {
        isDraggingPreviewRef.current = false;
        setIsDraggingPreview(false);
      }
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  function handlePreviewDividerMouseDown(e: React.MouseEvent) {
    isDraggingPreviewRef.current = true;
    setIsDraggingPreview(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = previewHeight;
    e.preventDefault();
  }

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
    // For RTF, measure the plain-text content rather than the HTML string length
    const countText = isRtf ? (rtfEditorRef.current?.innerText ?? text) : text;
    setCharCount(countText.length);
    setWordCount(countText.trim() ? countText.trim().split(/\s+/).length : 0);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void savePersist(note.id, text);
    }, SAVE_DEBOUNCE_MS);
  }

  async function savePersist(id: string, content: string) {
    const n = useNoteStore.getState().notes.find((x) => x.id === id);
    if (n?.sourceFilePath) {
      try {
        // content is HTML in RTF mode; convert to RTF for .rtf files on disk,
        // or to plain text for any other file type viewed in RTF mode.
        let writeContent = content;
        if (selectedFormat === 'RTF') {
          writeContent = n.sourceFilePath.toLowerCase().endsWith('.rtf')
            ? htmlToRtf(content)
            : stripHtmlTags(content);
        }
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
    const currentContent = isRtf
      ? (rtfEditorRef.current?.innerHTML ?? note.content)
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
      const html = rtfEditorRef.current?.innerHTML ?? note.content;
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
      // Use the plain-text rendering of the WYSIWYG div for AI prompts
      return rtfEditorRef.current?.innerText ?? stripHtmlTags(note?.content ?? '');
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
      // AI result is plain text — wrap in paragraphs and inject as HTML
      const htmlResult = result
        .split('\n')
        .map((line) => {
          const safe = line
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<p>${safe || '<br>'}</p>`;
        })
        .join('');
      if (rtfEditorRef.current) rtfEditorRef.current.innerHTML = htmlResult;
      updateNote(note.id, { content: htmlResult });
      if (detectedLanguage) setPaneDetectedLanguage(paneIndex, detectedLanguage);
      setAiDialogData(null);
      void savePersist(note.id, htmlResult);
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
  const isPlainText  = selectedFormat === 'Plain Text (Structured Notes)' || selectedFormat === 'Plain text'
    || selectedFormat === 'CSS' || selectedFormat === 'Go'
    || selectedFormat === 'INI / Config' || selectedFormat === 'Log' || selectedFormat === 'YAML / ENV';
  const isRust       = selectedFormat === 'Rust';
  const isHtmlCss    = selectedFormat === 'HTML/CSS';

  // Derive the HTML to display in the WYSIWYG editor.
  // When a .rtf file is loaded, note.content is raw RTF; convert it once here.
  // After the user edits, note.content is HTML and passes through unchanged.
  const rtfDisplayHtml = useMemo(() => {
    if (!isRtf) return '';
    if (content.trim().startsWith('{\\rtf')) return rtfToHtml(content);
    if (content.trim().startsWith('<') || content.trim() === '') return content;
    // Plain text switched to RTF — wrap each line in a paragraph
    return content
      .split('\n')
      .map((line) => {
        const safe = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<p>${safe || '<br>'}</p>`;
      })
      .join('');
  }, [isRtf, content]);

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
          <div
            ref={noteTitleWrapperRef}
            className="note-title-wrapper"
            style={{ width: noteTitleWidth }}
          >
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
            <div
              className={`note-title-resizer${noteTitleDragging ? ' dragging' : ''}`}
              onMouseDown={onNoteTitleResizerMouseDown}
            />
          </div>
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
                if (fmt === 'RTF' && selectedFormat !== 'RTF') {
                  // Switching TO RTF: convert current content to HTML for WYSIWYG
                  const current = editorRef.current?.getText() ?? note.content;
                  let asHtml: string;
                  if (current.trim().startsWith('{\\rtf')) {
                    asHtml = rtfToHtml(current);
                  } else if (current.trim().startsWith('<')) {
                    asHtml = current; // already HTML
                  } else {
                    asHtml = current
                      .split('\n')
                      .map((line) => {
                        const safe = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `<p>${safe || '<br>'}</p>`;
                      })
                      .join('');
                  }
                  updateNote(note.id, { content: asHtml });
                } else if (selectedFormat === 'RTF' && fmt !== 'RTF') {
                  // Switching FROM RTF: extract plain text from the WYSIWYG div
                  const html = rtfEditorRef.current?.innerHTML ?? note.content;
                  const plain = html
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<\/p>/gi,  '\n')
                    .replace(/<\/li>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g,  '&').replace(/&lt;/g, '<')
                    .replace(/&gt;/g,   '>').replace(/&nbsp;/g, ' ')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();
                  if (plain !== note.content) {
                    updateNote(note.id, { content: plain });
                  }
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
            <XmlToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} showInvisibles={showInvisibles} onToggleInvisibles={handleToggleInvisibles} />
          )}
          {/* Contextual toolbar — JSON */}
          {isJson && (
            <JsonToolbar
              editorRef={editorRef}
              disabled={paneState.isBusy || !note}
              previewOpen={jsonPreviewOpen}
              onPreviewToggle={() => setJsonPreviewOpen(v => !v)}
              showInvisibles={showInvisibles}
              onToggleInvisibles={handleToggleInvisibles}
            />
          )}
          {/* Contextual toolbar — SQL */}
          {isSql && (
            <SqlToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} paneIndex={paneIndex} showInvisibles={showInvisibles} onToggleInvisibles={handleToggleInvisibles} />
          )}
          {/* Contextual toolbar — Markdown */}
          {isMarkdown && (
            <MarkdownToolbar
              editorRef={editorRef}
              disabled={paneState.isBusy || !note}
              previewOpen={markdownPreviewOpen}
              onPreviewToggle={() => setMarkdownPreviewOpen(v => !v)}
              showInvisibles={showInvisibles}
              onToggleInvisibles={handleToggleInvisibles}
            />
          )}
          {/* Contextual toolbar — Python */}
          {isPython && (
            <PythonToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} showInvisibles={showInvisibles} onToggleInvisibles={handleToggleInvisibles} />
          )}
          {/* Contextual toolbar — JavaScript / TypeScript */}
          {isJs && (
            <JsToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} format={selectedFormat} showInvisibles={showInvisibles} onToggleInvisibles={handleToggleInvisibles} />
          )}
          {/* Contextual toolbar — C# */}
          {isCsharp && (
            <CSharpToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} showInvisibles={showInvisibles} onToggleInvisibles={handleToggleInvisibles} />
          )}
          {/* Contextual toolbar — Bash / PowerShell */}
          {isShell && (
            <ShellToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} format={selectedFormat} showInvisibles={showInvisibles} onToggleInvisibles={handleToggleInvisibles} />
          )}
          {/* Contextual toolbar — Java */}
          {isJava && (
            <JavaToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} showInvisibles={showInvisibles} onToggleInvisibles={handleToggleInvisibles} />
          )}
          {/* Contextual toolbar — C / C++ */}
          {isCpp && (
            <CppToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} format={selectedFormat} showInvisibles={showInvisibles} onToggleInvisibles={handleToggleInvisibles} />
          )}
          {/* Contextual toolbar — Plain Text */}
          {isPlainText && (
            <PlainTextToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} showInvisibles={showInvisibles} onToggleInvisibles={handleToggleInvisibles} />
          )}
          {/* Contextual toolbar — Rust */}
          {isRust && (
            <RustToolbar editorRef={editorRef} disabled={paneState.isBusy || !note} showInvisibles={showInvisibles} onToggleInvisibles={handleToggleInvisibles} />
          )}
          {/* Contextual toolbar — HTML/CSS */}
          {isHtmlCss && (
            <HtmlCssToolbar
              editorRef={editorRef}
              disabled={paneState.isBusy || !note}
              htmlPreviewOpen={htmlPreviewOpen}
              onHtmlPreviewToggle={() => setHtmlPreviewOpen(v => !v)}
              showInvisibles={showInvisibles}
              onToggleInvisibles={handleToggleInvisibles}
            />
          )}
        </div>
      </div>

      {/* Editor area — split view when CSV table or inline preview is active */}
      <div
        ref={editorAreaRef}
        className={[
          'editor-area',
          isCsv && showCsvTableView ? 'editor-area-split' : '',
        ].filter(Boolean).join(' ')}
      >
        {isRtf ? (
          <RtfEditor
            htmlContent={rtfDisplayHtml}
            fontFamily={settings.fontFamily}
            fontSize={settings.fontSize}
            onChange={handleEditorChange}
            editorRef={rtfEditorRef}
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
            showInvisibles={showInvisibles}
            onChange={handleEditorChange}
            onLineChange={setLineNumber}
            onSelectionChange={setSelLabel}
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

        {/* Markdown preview panel */}
        {isMarkdown && markdownPreviewOpen && (
          <>
            <div
              className={`preview-divider${isDraggingPreview ? ' dragging' : ''}`}
              onMouseDown={handlePreviewDividerMouseDown}
            >
              <span className="preview-divider-dots">· · ·</span>
            </div>
            <div className="inline-preview-panel" style={{ height: previewHeight, flex: 'none', minHeight: 80 }}>
              <div className="inline-preview-label">PREVIEW</div>
              <div
                className="markdown-preview-body"
                dangerouslySetInnerHTML={{ __html: mdPreviewHtml }}
              />
            </div>
          </>
        )}

        {/* HTML/CSS preview panel — sandboxed iframe */}
        {isHtmlCss && htmlPreviewOpen && (
          <>
            <div
              className={`preview-divider${isDraggingPreview ? ' dragging' : ''}`}
              onMouseDown={handlePreviewDividerMouseDown}
            >
              <span className="preview-divider-dots">· · ·</span>
            </div>
            <div className="inline-preview-panel" style={{ height: previewHeight, flex: 'none', minHeight: 80 }}>
              <div className="inline-preview-label">PREVIEW (inline)</div>
              <iframe
                ref={htmlIframeRef}
                style={{ flex: 1, border: 'none', background: '#ffffff', minHeight: 0 }}
                sandbox="allow-same-origin allow-scripts"
                title="HTML Preview"
              />
            </div>
          </>
        )}

        {/* JSON tree view panel */}
        {isJson && jsonPreviewOpen && (
          <>
            <div
              className={`preview-divider${isDraggingPreview ? ' dragging' : ''}`}
              onMouseDown={handlePreviewDividerMouseDown}
            >
              <span className="preview-divider-dots">· · ·</span>
            </div>
            <div className="inline-preview-panel" style={{ height: previewHeight, flex: 'none', minHeight: 80 }}>
              <div className="inline-preview-label">PREVIEW</div>
              <div style={{ overflow: 'auto', flex: 1, minHeight: 0, padding: '4px 8px' }}>
                <JsonTreeView content={content} />
              </div>
            </div>
          </>
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
        format={selectedFormat}
        dialect={paneState.paneDialect}
        selLabel={selLabel}
        lineEnding={lineEnding}
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
