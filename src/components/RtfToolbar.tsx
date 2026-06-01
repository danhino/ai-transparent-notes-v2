import { useState, useRef, useEffect } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { encodeRtfText } from '../utils/rtfParser';

// ─── RTF control word helpers ─────────────────────────────────────────────────

/** Wrap selected text in an RTF inline group, or insert an empty group at cursor. */
function wrapInline(ed: NoteEditorRef, open: string, close = '}') {
  const sel = ed.getSelection();
  if (sel) {
    ed.replaceSelection(`${open}${encodeRtfText(sel)}${close}`);
  } else {
    ed.replaceSelection(`${open}${close}`);
  }
}

/** Replace selected text with a paragraph-level RTF block. */
function wrapBlock(ed: NoteEditorRef, open: string) {
  const sel = ed.getSelection();
  ed.replaceSelection(`${open}${encodeRtfText(sel)}\\par\n`);
}

// ─── RtfToolbar ───────────────────────────────────────────────────────────────

interface Props {
  editorRef: React.RefObject<NoteEditorRef | null>;
  disabled: boolean;
}

export function RtfToolbar({ editorRef, disabled }: Props) {
  const [showTable, setShowTable]     = useState(false);
  const [hoverTable, setHoverTable]   = useState({ r: 0, c: 0 });
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTable) return;
    function outside(e: MouseEvent) {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setShowTable(false);
      }
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [showTable]);

  // Prevent focus theft so CodeMirror keeps its selection
  const noFocus = (e: React.MouseEvent) => e.preventDefault();
  const ed = () => editorRef.current;

  // ── Formatting handlers ────────────────────────────────────────────────────
  function handleBold()      { const e = ed(); if (e) wrapInline(e, '{\\b '); }
  function handleItalic()    { const e = ed(); if (e) wrapInline(e, '{\\i '); }
  function handleUnderline() { const e = ed(); if (e) wrapInline(e, '{\\ul '); }
  function handleStrike()    { const e = ed(); if (e) wrapInline(e, '{\\strike '); }

  function handleH1() { const e = ed(); if (e) wrapBlock(e, '{\\fs36\\b '); }
  function handleH2() { const e = ed(); if (e) wrapBlock(e, '{\\fs28\\b '); }
  function handleH3() { const e = ed(); if (e) wrapBlock(e, '{\\fs24\\b '); }

  function handleBullet() {
    const e = ed();
    if (!e) return;
    const sel = e.getSelection();
    const lines = sel ? sel.split('\n') : [''];
    const rtf = lines
      .map((l) => `{\\pard\\fi-360\\li720\\bullet ${encodeRtfText(l)}\\par}`)
      .join('\n');
    e.replaceSelection(rtf + '\n');
  }

  function handleFontSize(pt: number) {
    // RTF font size uses half-points: \fs24 = 12pt
    const e = ed();
    if (e) wrapInline(e, `{\\fs${pt * 2} `);
  }

  function handleHR() {
    ed()?.replaceSelection('\n\\par ________________\\par\n');
  }

  function handleTable(rows: number, cols: number) {
    const colWidth = Math.floor(8640 / cols); // twips (~15 cm page width)
    let rtf = '\n';
    for (let r = 0; r < rows; r++) {
      rtf += '\\trowd';
      let pos = 0;
      for (let c = 0; c < cols; c++) {
        pos += colWidth;
        rtf += `\\cellx${pos}`;
      }
      rtf += '\n';
      for (let c = 0; c < cols; c++) {
        rtf += '\\pard\\intbl \\cell\n';
      }
      rtf += '\\row\n';
    }
    ed()?.replaceSelection(rtf);
  }

  // ── JSX ────────────────────────────────────────────────────────────────────
  const sep = <div className="ctx-toolbar-sep" />;

  function btn(label: React.ReactNode, onClick: () => void, title: string) {
    return (
      <button className="ctx-btn" onMouseDown={noFocus} onClick={onClick}
        disabled={disabled} title={title}>{label}</button>
    );
  }

  return (
    <div className="contextual-toolbar">
      <div className="ctx-toolbar-row">

        {btn(<strong>B</strong>,  handleBold,      '{\\b text} — bold')}
        {btn(<em>I</em>,           handleItalic,    '{\\i text} — italic')}
        {btn(<span style={{ textDecoration: 'underline' }}>U</span>,
          handleUnderline, '{\\ul text} — underline')}
        {btn(<span style={{ textDecoration: 'line-through' }}>S</span>,
          handleStrike, '{\\strike text} — strikethrough')}

        {sep}

        {btn('H1', handleH1, 'Heading 1 — {\\fs36\\b text}\\par')}
        {btn('H2', handleH2, 'Heading 2 — {\\fs28\\b text}\\par')}
        {btn('H3', handleH3, 'Heading 3 — {\\fs24\\b text}\\par')}

        {sep}

        {btn('• list', handleBullet, '\\pard\\fi-360\\li720\\bullet text\\par')}

        {sep}

        <span style={{ fontSize: 11, color: 'var(--text-secondary)', paddingRight: 2 }}>
          Size:
        </span>
        {([10, 12, 14, 18, 24, 36] as const).map((sz) =>
          btn(sz, () => handleFontSize(sz), `{\\fs${sz * 2} text} — ${sz}pt`)
        )}

        {sep}

        <div style={{ position: 'relative' }}>
          <button className="ctx-btn" onMouseDown={noFocus} disabled={disabled}
            onClick={() => setShowTable((v) => !v)} title="Insert RTF table">⊞
          </button>
          {showTable && (
            <div ref={tableRef} className="table-picker-popup">
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {hoverTable.r > 0 ? `${hoverTable.r} × ${hoverTable.c}` : 'Select size'}
              </div>
              <div className="table-picker-grid">
                {Array.from({ length: 6 }, (_, r) =>
                  Array.from({ length: 6 }, (_, c) => (
                    <button key={`${r}-${c}`}
                      className={`table-picker-cell${r < hoverTable.r && c < hoverTable.c ? ' active' : ''}`}
                      onMouseEnter={() => setHoverTable({ r: r + 1, c: c + 1 })}
                      onClick={() => { handleTable(r + 1, c + 1); setShowTable(false); }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {btn('—', handleHR, 'Horizontal rule — \\par ___…___\\par')}

      </div>
    </div>
  );
}
