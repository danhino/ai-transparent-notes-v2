import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, WidgetType } from '@codemirror/view';
import { EditorState, StateField, StateEffect, Extension } from '@codemirror/state';
import { Decoration, DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { sql } from '@codemirror/lang-sql';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { DiffBlock } from '../types';

// ─── Deleted-line widget (shows removed lines inline with red background) ────

class DeletedLinesWidget extends WidgetType {
  constructor(
    private readonly lines: string[],
    private readonly color: string,
  ) { super(); }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      `background: ${this.color}`,
      'padding: 0 12px',
      'font-family: inherit',
      'font-size: inherit',
      'line-height: inherit',
      'white-space: pre-wrap',
      'border-left: 2px solid rgba(220,60,60,0.55)',
      'pointer-events: none',
      'user-select: none',
    ].join(';');
    wrap.textContent = this.lines.join('\n');
    return wrap;
  }

  eq(other: DeletedLinesWidget): boolean {
    return this.color === other.color && this.lines.join('\n') === other.lines.join('\n');
  }

  get estimatedHeight(): number {
    return this.lines.length * 20;
  }

  ignoreEvent(): boolean { return true; }
}

// ─── Diff decoration state ───────────────────────────────────────────────────

const setDiffEffect = StateEffect.define<{
  postText: string;
  blocks: DiffBlock[];
  addedColor: string;
  deletedColor: string;
} | null>();

const diffDecorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decs, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDiffEffect)) {
        if (!effect.value) return Decoration.none;
        const { blocks, addedColor, deletedColor } = effect.value;
        const marks: { from: number; deco: Decoration }[] = [];
        const doc = tr.state.doc;

        for (const block of blocks) {
          if (block.type === 'equal') continue;

          // Green highlight on added/changed lines in the post text
          if (block.type === 'added' || block.type === 'changed') {
            for (let l = 0; l < block.linesB.length; l++) {
              const lineNo = block.startB + l + 1; // 1-indexed
              if (lineNo < 1 || lineNo > doc.lines) continue;
              const line = doc.line(lineNo);
              marks.push({
                from: line.from,
                deco: Decoration.line({ attributes: { style: `background: ${addedColor}` } }),
              });
            }
          }

          // Red widget showing removed lines before their insertion point
          if ((block.type === 'deleted' || block.type === 'changed') && block.linesA.length > 0) {
            const insertLineNo = block.startB + 1; // 1-indexed line before which to insert
            const insertPos = insertLineNo <= doc.lines
              ? doc.line(insertLineNo).from
              : doc.length;
            marks.push({
              from: insertPos,
              deco: Decoration.widget({
                widget: new DeletedLinesWidget(block.linesA, deletedColor),
                side: -1,
                block: true,
              }),
            });
          }
        }

        marks.sort((a, b) => a.from - b.from);
        return Decoration.set(marks.map((m) => m.deco.range(m.from, m.from)), true);
      }
    }
    return decs.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

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
  applyDiff: (postText: string, blocks: DiffBlock[], addedColor: string, deletedColor: string) => void;
  clearDiff: () => void;
  getLineNumber: () => number;
}

interface Props {
  content: string;
  fontFamily: string;
  fontSize: number;
  detectedLanguage: string | null;
  onChange: (text: string) => void;
  onLineChange?: (line: number) => void;
}

export const NoteEditor = forwardRef<NoteEditorRef, Props>(function NoteEditor(
  { content, fontFamily, fontSize, detectedLanguage, onChange, onLineChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onLineChangeRef = useRef(onLineChange);
  onChangeRef.current = onChange;
  onLineChangeRef.current = onLineChange;

  const initEditor = useCallback(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
      if (update.selectionSet || update.docChanged) {
        const line = update.state.doc.lineAt(update.state.selection.main.head).number;
        onLineChangeRef.current?.(line);
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        buildTheme(fontFamily, fontSize),
        langExtension(detectedLanguage),
        diffDecorationField,
        history(),
        lineNumbers(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        updateListener,
        EditorView.lineWrapping,
      ],
    });

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

  // Rebuild when font or language changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    view.destroy();
    viewRef.current = null;
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) onChangeRef.current(update.state.doc.toString());
      if (update.selectionSet || update.docChanged) {
        const line = update.state.doc.lineAt(update.state.selection.main.head).number;
        onLineChangeRef.current?.(line);
      }
    });

    const state = EditorState.create({
      doc: currentDoc,
      extensions: [
        buildTheme(fontFamily, fontSize),
        langExtension(detectedLanguage),
        diffDecorationField,
        history(),
        lineNumbers(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    viewRef.current = new EditorView({ state, parent: containerRef.current });
  }, [fontFamily, fontSize, detectedLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

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

    applyDiff: (postText, blocks, addedColor, deletedColor) => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: postText },
        effects: setDiffEffect.of({ postText, blocks, addedColor, deletedColor }),
      });
    },

    clearDiff: () => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ effects: setDiffEffect.of(null) });
    },

    getLineNumber: () => {
      const view = viewRef.current;
      if (!view) return 1;
      return view.state.doc.lineAt(view.state.selection.main.head).number;
    },
  }));

  return <div ref={containerRef} className="editor-wrap" />;
});
