import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { sql } from '@codemirror/lang-sql';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';

// ─── Theme ───────────────────────────────────────────────────────────────────

function buildTheme(fontFamily: string, fontSize: number): Extension {
  return EditorView.theme({
    '&': {
      height: '100%',
      background: 'var(--editor-bg)',
      color: 'var(--editor-fg)',
      fontSize: `${fontSize}px`,
      fontFamily,
    },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-content': { caretColor: 'var(--editor-fg)', padding: '8px 0' },
    '.cm-line': { padding: '0 12px' },
    '.cm-gutters': {
      background: 'var(--toolbar-bg)',
      color: 'var(--subtle-text)',
      border: 'none',
      borderRight: '1px solid var(--border)',
    },
    '.cm-activeLine': { background: 'rgba(255,255,255,0.03)' },
    '.cm-activeLineGutter': { background: 'rgba(255,255,255,0.05)' },
    '.cm-cursor': { borderLeftColor: 'var(--editor-fg)' },
    '.cm-selectionBackground': { background: 'rgba(137,180,250,0.25) !important' },
    '&.cm-focused .cm-selectionBackground': { background: 'rgba(137,180,250,0.3) !important' },
  });
}

function langExtension(lang: string | null): Extension {
  if (!lang) return [];
  const l = lang.toLowerCase();
  if (l === 'javascript' || l === 'js' || l === 'typescript' || l === 'ts') return javascript({ typescript: l.includes('t') });
  if (l === 'python' || l === 'py') return python();
  if (l === 'markdown' || l === 'md') return markdown();
  if (l === 'html') return html();
  if (l === 'sql') return sql();
  if (l === 'cpp' || l === 'c++' || l === 'c') return cpp();
  if (l === 'java') return java();
  return [];
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface NoteEditorRef {
  getText: () => string;
  getSelection: () => string;
  hasSelection: () => boolean;
  applyText: (text: string) => void;
  getLineNumber: () => number;
}

interface Props {
  content: string;
  fontFamily: string;
  fontSize: number;
  detectedLanguage: string | null;
  showLineNumbers?: boolean;
  onChange: (text: string) => void;
  onLineChange?: (line: number) => void;
}

export const NoteEditor = forwardRef<NoteEditorRef, Props>(function NoteEditor(
  { content, fontFamily, fontSize, detectedLanguage, showLineNumbers = true, onChange, onLineChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onLineChangeRef = useRef(onLineChange);
  onChangeRef.current = onChange;
  onLineChangeRef.current = onLineChange;

  function buildExtensions(doc: string): EditorState {
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
      if (update.selectionSet || update.docChanged) {
        const line = update.state.doc.lineAt(update.state.selection.main.head).number;
        onLineChangeRef.current?.(line);
      }
    });

    return EditorState.create({
      doc,
      extensions: [
        buildTheme(fontFamily, fontSize),
        langExtension(detectedLanguage),
        history(),
        ...(showLineNumbers ? [lineNumbers()] : []),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        updateListener,
        EditorView.lineWrapping,
      ],
    });
  }

  const initEditor = useCallback(() => {
    if (!containerRef.current) return;
    const state = buildExtensions(content);
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mount once
  useEffect(() => {
    initEditor();
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [initEditor]);

  // Sync content when note changes (not on every keystroke)
  const lastContentRef = useRef(content);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content && content !== lastContentRef.current) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
    lastContentRef.current = content;
  }, [content]);

  // Rebuild when font, language, or line number visibility changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    view.destroy();
    viewRef.current = null;
    if (!containerRef.current) return;
    const state = buildExtensions(currentDoc);
    viewRef.current = new EditorView({ state, parent: containerRef.current });
  }, [fontFamily, fontSize, detectedLanguage, showLineNumbers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose imperative API
  useImperativeHandle(ref, () => ({
    getText: () => viewRef.current?.state.doc.toString() ?? '',

    getSelection: () => {
      const view = viewRef.current;
      if (!view) return '';
      const { from, to } = view.state.selection.main;
      return view.state.doc.sliceString(from, to);
    },

    hasSelection: () => {
      const view = viewRef.current;
      if (!view) return false;
      const { from, to } = view.state.selection.main;
      return from !== to;
    },

    applyText: (text) => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      });
    },

    getLineNumber: () => {
      const view = viewRef.current;
      if (!view) return 1;
      return view.state.doc.lineAt(view.state.selection.main.head).number;
    },
  }));

  return <div ref={containerRef} className="editor-wrap" />;
});
