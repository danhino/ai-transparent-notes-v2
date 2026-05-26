import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface RichTextEditorRef {
  /** Full HTML content of the editor */
  getHTML: () => string;
  /** Plain text (no tags) — used by the AI pipeline */
  getText: () => string;
  /** Selected plain text */
  getSelection: () => string;
  hasSelection: () => boolean;
  /** Run a document.execCommand formatting command */
  execFormat: (command: string, value?: string) => void;
  /** Query whether a format toggle is active at the cursor */
  queryFormat: (command: string) => boolean;
  /** Insert raw HTML at the caret via execCommand */
  insertHTML: (html: string) => void;
  /** Replace the entire content and fire onChange */
  setContent: (html: string) => void;
  focus: () => void;
}

interface Props {
  htmlContent: string;
  fontFamily: string;
  fontSize: number;
  onChange: (html: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RichTextEditor = forwardRef<RichTextEditorRef, Props>(function RichTextEditor(
  { htmlContent, fontFamily, fontSize, onChange },
  ref
) {
  const divRef    = useRef<HTMLDivElement>(null);
  const onChangeCb = useRef(onChange);
  onChangeCb.current = onChange;
  const isComposing = useRef(false);

  // ── Mount: set initial content ──────────────────────────────────────────────
  useEffect(() => {
    if (divRef.current) divRef.current.innerHTML = htmlContent;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync external content changes (tab switch, file reload, AI apply) ───────
  // Do NOT override innerHTML while the editor has focus — that would reset
  // the cursor mid-typing. External reloads only happen when not focused.
  useEffect(() => {
    const div = divRef.current;
    if (!div) return;
    if (document.activeElement === div) return; // user is typing, leave alone
    if (div.innerHTML !== htmlContent) {
      div.innerHTML = htmlContent;
    }
  }, [htmlContent]);

  // ── Imperative API ──────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getHTML: () => divRef.current?.innerHTML ?? '',
    getText: () => divRef.current?.innerText ?? '',

    getSelection: () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return '';
      if (divRef.current && !divRef.current.contains(sel.anchorNode)) return '';
      return sel.toString();
    },

    hasSelection: () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return false;
      return !!(divRef.current?.contains(sel.anchorNode));
    },

    execFormat: (command, value) => {
      divRef.current?.focus();
      document.execCommand(command, false, value);
    },

    queryFormat: (command) => document.queryCommandState(command),

    insertHTML: (html) => {
      divRef.current?.focus();
      document.execCommand('insertHTML', false, html);
    },

    setContent: (html) => {
      if (!divRef.current) return;
      divRef.current.innerHTML = html;
      onChangeCb.current(html);
    },

    focus: () => divRef.current?.focus(),
  }));

  // ── Input handler ───────────────────────────────────────────────────────────
  function handleInput() {
    if (!isComposing.current) {
      onChangeCb.current(divRef.current?.innerHTML ?? '');
    }
  }

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      className="rich-text-editor editor-wrap"
      onInput={handleInput}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={() => {
        isComposing.current = false;
        onChangeCb.current(divRef.current?.innerHTML ?? '');
      }}
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '8px 12px',
        outline: 'none',
        background: 'var(--editor-bg)',
        color: 'var(--editor-fg)',
        fontSize: `${fontSize}px`,
        fontFamily,
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    />
  );
});
