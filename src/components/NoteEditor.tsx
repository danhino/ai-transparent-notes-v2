import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState, Compartment, Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { getLanguageExtension } from '../utils/languageMap';
import { showInvisiblesPlugin } from '../utils/showInvisiblesPlugin';

// ─── Theme ───────────────────────────────────────────────────────────────────

function buildBaseTheme(fontFamily: string, fontSize: number): Extension {
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

function isSyntaxDarkTheme(activeTheme: string): boolean {
  return activeTheme === 'dark' || activeTheme === 'blue';
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface NoteEditorRef {
  getText: () => string;
  getSelection: () => string;
  hasSelection: () => boolean;
  applyText: (text: string) => void;
  replaceSelection: (text: string) => void;
  getCursorOffset: () => number;
  getLineNumber: () => number;
}

interface Props {
  content: string;
  fontFamily: string;
  fontSize: number;
  language: string;
  activeTheme: string;
  showLineNumbers?: boolean;
  showInvisibles?: boolean;
  onChange: (text: string) => void;
  onLineChange?: (line: number) => void;
  onSelectionChange?: (label: string | null) => void;
}

export const NoteEditor = forwardRef<NoteEditorRef, Props>(function NoteEditor(
  { content, fontFamily, fontSize, language, activeTheme, showLineNumbers = true, showInvisibles = false, onChange, onLineChange, onSelectionChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onLineChangeRef = useRef(onLineChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onChangeRef.current = onChange;
  onLineChangeRef.current = onLineChange;
  onSelectionChangeRef.current = onSelectionChange;

  // Stable compartment refs — created once, reused for the lifetime of the editor
  const langComp = useRef(new Compartment());
  const syntaxComp = useRef(new Compartment());
  const fontComp = useRef(new Compartment());
  const lineNumComp = useRef(new Compartment());
  const invisiblesComp = useRef(new Compartment());

  const initEditor = useCallback(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
      if (update.selectionSet || update.docChanged) {
        const line = update.state.doc.lineAt(update.state.selection.main.head).number;
        onLineChangeRef.current?.(line);

        const sel = update.state.selection.main;
        const selectedChars = sel.to - sel.from;
        if (selectedChars > 0) {
          const fromLine = update.state.doc.lineAt(sel.from).number;
          const toLine = update.state.doc.lineAt(sel.to).number;
          onSelectionChangeRef.current?.(`Sel: ${selectedChars} | ${toLine - fromLine + 1}`);
        } else {
          onSelectionChangeRef.current?.(null);
        }
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        langComp.current.of(getLanguageExtension(language) ?? []),
        syntaxComp.current.of(isSyntaxDarkTheme(activeTheme) ? oneDark : syntaxHighlighting(defaultHighlightStyle)),
        fontComp.current.of(buildBaseTheme(fontFamily, fontSize)),
        lineNumComp.current.of(showLineNumbers ? lineNumbers() : []),
        invisiblesComp.current.of(showInvisibles ? showInvisiblesPlugin() : []),
        history(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    viewRef.current = new EditorView({ state, parent: containerRef.current });
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

  // Sync content when note changes (tab switch, external file write, etc.)
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

  // Reconfigure language compartment when format or detected language changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: langComp.current.reconfigure(getLanguageExtension(language) ?? []),
    });
  }, [language]);

  // Reconfigure syntax theme compartment when app theme changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: syntaxComp.current.reconfigure(isSyntaxDarkTheme(activeTheme) ? oneDark : syntaxHighlighting(defaultHighlightStyle)),
    });
  }, [activeTheme]);

  // Reconfigure base theme compartment when font or size changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: fontComp.current.reconfigure(buildBaseTheme(fontFamily, fontSize)),
    });
  }, [fontFamily, fontSize]);

  // Reconfigure line numbers compartment
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: lineNumComp.current.reconfigure(showLineNumbers ? lineNumbers() : []),
    });
  }, [showLineNumbers]);

  // Reconfigure invisibles compartment
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: invisiblesComp.current.reconfigure(showInvisibles ? showInvisiblesPlugin() : []),
    });
  }, [showInvisibles]);

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

    replaceSelection: (text) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text } });
    },

    getCursorOffset: () => {
      const view = viewRef.current;
      if (!view) return 0;
      return view.state.selection.main.head;
    },

    getLineNumber: () => {
      const view = viewRef.current;
      if (!view) return 1;
      return view.state.doc.lineAt(view.state.selection.main.head).number;
    },
  }));

  return <div ref={containerRef} className="editor-wrap" />;
});
