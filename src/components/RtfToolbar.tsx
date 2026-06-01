import { useState, useRef, useEffect } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { encodeRtfText } from '../utils/rtfParser';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONTS = [
  'Arial', 'Segoe UI', 'Times New Roman', 'Georgia', 'Calibri',
  'Verdana', 'Tahoma', 'Trebuchet MS', 'Courier New', 'Consolas',
  'Cascadia Code', 'Comic Sans MS',
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72];

const RTF_STYLES = [
  'Normal', 'Heading 1', 'Heading 2', 'Heading 3',
  'Title', 'Subtitle', 'Quote', 'Code',
];

const MARGIN_OPTIONS = ['Normal', 'Narrow', 'Wide', 'Mirrored'];
const PAGE_SIZES = ['A4', 'Letter', 'Legal', 'A3'];

const SWATCH_COLORS = [
  '#000000', '#808080', '#C0C0C0', '#FFFFFF', '#FF0000',
  '#800000', '#FF8000', '#808000', '#FFFF00', '#00FF00',
  '#008000', '#00FFFF', '#008080', '#0000FF', '#000080',
  '#FF00FF', '#800080', '#FF69B4', '#8B4513', '#FFA500',
];

// ─── RTF helpers ──────────────────────────────────────────────────────────────

function wrapInline(ed: NoteEditorRef, open: string, close = '}') {
  const sel = ed.getSelection();
  ed.replaceSelection(sel ? `${open}${encodeRtfText(sel)}${close}` : `${open}${close}`);
}

function wrapBlock(ed: NoteEditorRef, open: string) {
  const sel = ed.getSelection();
  // open starts with '{', so we close the group before \par
  ed.replaceSelection(`${open}${encodeRtfText(sel)}}\\par\n`);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ColorSwatchProps { onSelect: (c: string) => void; onClose: () => void; }

function ColorSwatch({ onSelect, onClose }: ColorSwatchProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="color-swatch-popup">
      {SWATCH_COLORS.map((c) => (
        <button key={c} className="color-swatch-cell" style={{ background: c }}
          onClick={() => { onSelect(c); onClose(); }} title={c} />
      ))}
    </div>
  );
}

interface TablePickerProps { onSelect: (r: number, c: number) => void; onClose: () => void; }

function TablePicker({ onSelect, onClose }: TablePickerProps) {
  const [hover, setHover] = useState({ r: 0, c: 0 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="table-picker-popup">
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {hover.r > 0 ? `${hover.r} × ${hover.c}` : 'Select table size'}
      </div>
      <div className="table-picker-grid">
        {Array.from({ length: 8 }, (_, r) =>
          Array.from({ length: 8 }, (_, c) => (
            <button
              key={`${r}-${c}`}
              className={`table-picker-cell${r < hover.r && c < hover.c ? ' active' : ''}`}
              onMouseEnter={() => setHover({ r: r + 1, c: c + 1 })}
              onClick={() => { onSelect(r + 1, c + 1); onClose(); }}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── RtfToolbar ───────────────────────────────────────────────────────────────

interface Props {
  editorRef: React.RefObject<NoteEditorRef | null>;
  disabled: boolean;
  previewOpen: boolean;
  onPreviewToggle: () => void;
}

export function RtfToolbar({ editorRef, disabled, previewOpen, onPreviewToggle }: Props) {
  const [activeStyle,  setActiveStyle]  = useState('Normal');
  const [activeFont,   setActiveFont]   = useState('Arial');
  const [activeSize,   setActiveSize]   = useState(12);
  const [showFontColor,   setShowFontColor]   = useState(false);
  const [showHighlight,   setShowHighlight]   = useState(false);
  const [showTable,       setShowTable]       = useState(false);
  const [showFormattingMarks, setShowFormattingMarks] = useState(false);

  const noFocus = (e: React.MouseEvent) => e.preventDefault();
  const ed = () => editorRef.current;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleBold()      { const e = ed(); if (e) wrapInline(e, '{\\b '); }
  function handleItalic()    { const e = ed(); if (e) wrapInline(e, '{\\i '); }
  function handleUnderline() { const e = ed(); if (e) wrapInline(e, '{\\ul '); }
  function handleStrike()    { const e = ed(); if (e) wrapInline(e, '{\\strike '); }

  function handleStyle(style: string) {
    const e = ed();
    if (!e) return;
    switch (style) {
      case 'Heading 1': wrapBlock(e, '{\\fs40\\b '); break;
      case 'Heading 2': wrapBlock(e, '{\\fs32\\b '); break;
      case 'Heading 3': wrapBlock(e, '{\\fs28\\b '); break;
      case 'Title':     wrapBlock(e, '{\\fs48\\b '); break;
      case 'Subtitle':  wrapBlock(e, '{\\fs36\\i '); break;
      case 'Quote':     wrapBlock(e, '{\\li720\\i '); break;
      case 'Code':      wrapBlock(e, '{\\f1 '); break;
      default:          wrapBlock(e, '{\\fs24 '); break;
    }
    setActiveStyle(style);
  }

  function handleFont(font: string) {
    setActiveFont(font);
    const e = ed();
    if (e) wrapInline(e, `{\\f0 `); // simplified: just mark font group
  }

  function handleSize(size: number) {
    setActiveSize(size);
    const e = ed();
    if (e) wrapInline(e, `{\\fs${size * 2} `);
  }

  function handleAlign(dir: 'l' | 'c' | 'r' | 'j') {
    const word = { l: '\\ql', c: '\\qc', r: '\\qr', j: '\\qj' }[dir];
    const e = ed();
    if (!e) return;
    const sel = e.getSelection();
    e.replaceSelection(`\\pard${word} ${encodeRtfText(sel)}\\par\n`);
  }

  function handleIndent(increase: boolean) {
    const e = ed();
    if (!e) return;
    const sel = e.getSelection();
    const word = increase ? '\\li720' : '\\li0';
    e.replaceSelection(`\\pard${word} ${encodeRtfText(sel)}\\par\n`);
  }

  function handleBulletList() {
    const e = ed();
    if (!e) return;
    const sel = e.getSelection();
    const lines = sel ? sel.split('\n') : [''];
    const rtf = lines
      .map((l) => `\\pard\\fi-240\\li480\\bullet\\tx480 ${encodeRtfText(l)}\\par`)
      .join('\n');
    e.replaceSelection(rtf + '\n\\pard\n');
  }

  function handleNumberedList() {
    const e = ed();
    if (!e) return;
    const sel = e.getSelection();
    const lines = sel ? sel.split('\n') : [''];
    const rtf = lines
      .map((l, i) => `\\pard\\fi-240\\li480 ${i + 1}. ${encodeRtfText(l)}\\par`)
      .join('\n');
    e.replaceSelection(rtf + '\n\\pard\n');
  }

  function handleTable(rows: number, cols: number) {
    const colWidth = Math.floor(8640 / cols);
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

  function handleImage() {
    ed()?.replaceSelection('\n\\par [Image placeholder]\\par\n');
  }

  function handleHR() {
    ed()?.replaceSelection('\n\\brdrb\\brdrs\\brdrw10\\par\n');
  }

  function handleColorSelect(color: string) {
    // Convert hex color to RTF color table index approximation
    const e = ed();
    if (!e) wrapInline(e!, `{\\cf1 `);
    else wrapInline(e, `{\\cf1 `); // simplified: uses color index 1
    void color; // full colortbl support requires rebuilding the document header
  }

  function handleHighlightSelect(color: string) {
    const e = ed();
    if (e) wrapInline(e, `{\\highlight1 `);
    void color;
  }

  function handleClearFormatting() {
    const e = ed();
    if (!e) return;
    const sel = e.getSelection();
    e.replaceSelection(encodeRtfText(sel));
  }

  // ── JSX ────────────────────────────────────────────────────────────────────
  const sep = <div className="ctx-toolbar-sep" />;
  const btnClass = (active: boolean) => `ctx-btn${active ? ' ctx-btn-active' : ''}`;

  return (
    <div className="contextual-toolbar">

      {/* ── Row 1 ──────────────────────────────────────────────────────────── */}
      <div className="ctx-toolbar-row">

        <select className="ctx-select" value={activeStyle}
          onChange={(e) => handleStyle(e.target.value)}
          disabled={disabled} title="Paragraph style">
          {RTF_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {sep}

        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleBold}
          disabled={disabled} title="{\\b text} — bold"><strong>B</strong></button>
        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleItalic}
          disabled={disabled} title="{\\i text} — italic"><em>I</em></button>
        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleUnderline}
          disabled={disabled} title="{\\ul text} — underline">
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>
        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleStrike}
          disabled={disabled} title="{\\strike text} — strikethrough">
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </button>

        {sep}

        <select className="ctx-select" value={activeFont}
          onChange={(e) => handleFont(e.target.value)}
          disabled={disabled} title="Font family" style={{ maxWidth: 110 }}>
          {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <select className="ctx-select" value={activeSize}
          onChange={(e) => handleSize(Number(e.target.value))}
          disabled={disabled} title="Font size (\\fsN)" style={{ width: 50 }}>
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {sep}

        <div style={{ position: 'relative' }}>
          <button className="ctx-btn" onMouseDown={noFocus}
            onClick={() => { setShowFontColor((v) => !v); setShowHighlight(false); setShowTable(false); }}
            disabled={disabled} title="Font color (\\cfN)">
            <span style={{ borderBottom: '2px solid var(--accent)' }}>A</span>
          </button>
          {showFontColor && <ColorSwatch onSelect={handleColorSelect} onClose={() => setShowFontColor(false)} />}
        </div>

        <div style={{ position: 'relative' }}>
          <button className="ctx-btn" onMouseDown={noFocus}
            onClick={() => { setShowHighlight((v) => !v); setShowFontColor(false); setShowTable(false); }}
            disabled={disabled} title="Highlight color (\\highlight)">
            <span style={{ background: '#FFFF00', color: '#000', padding: '0 2px', fontSize: 9 }}>ab</span>
          </button>
          {showHighlight && <ColorSwatch onSelect={handleHighlightSelect} onClose={() => setShowHighlight(false)} />}
        </div>

        {sep}

        {(['l', 'c', 'r', 'j'] as const).map((a) => (
          <button key={a} className="ctx-btn" onMouseDown={noFocus}
            onClick={() => handleAlign(a)} disabled={disabled}
            title={`Align ${a === 'l' ? 'left' : a === 'c' ? 'center' : a === 'r' ? 'right' : 'justify'} (\\q${a})`}>
            {a === 'l' ? '⬤≡' : a === 'c' ? '≡' : a === 'r' ? '≡⬤' : '≡≡'}
          </button>
        ))}

        {sep}

        <button
          className={btnClass(previewOpen)}
          onMouseDown={noFocus}
          onClick={onPreviewToggle}
          disabled={disabled}
          title={previewOpen ? 'Hide preview' : 'Show preview'}
        >
          {previewOpen ? 'Hide preview' : 'Preview'}
        </button>

      </div>

      {/* ── Row 2 ──────────────────────────────────────────────────────────── */}
      <div className="ctx-toolbar-row">

        <select className="ctx-select" disabled={disabled} title="Margin" style={{ width: 80 }}>
          {MARGIN_OPTIONS.map((m) => <option key={m}>{m}</option>)}
        </select>

        <button className="ctx-btn" onMouseDown={noFocus} onClick={() => handleIndent(true)}
          disabled={disabled} title="Increase indent (\\li+720)">→</button>
        <button className="ctx-btn" onMouseDown={noFocus} onClick={() => handleIndent(false)}
          disabled={disabled} title="Decrease indent (\\li0)">←</button>

        <select className="ctx-select" disabled={disabled} title="Page size" style={{ width: 62 }}>
          {PAGE_SIZES.map((p) => <option key={p}>{p}</option>)}
        </select>

        {sep}

        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleBulletList}
          disabled={disabled} title="Bullet list (\\bullet)">•≡</button>
        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleNumberedList}
          disabled={disabled} title="Numbered list">1.</button>

        <div style={{ position: 'relative' }}>
          <button className="ctx-btn" onMouseDown={noFocus}
            onClick={() => { setShowTable((v) => !v); setShowFontColor(false); setShowHighlight(false); }}
            disabled={disabled} title="Insert RTF table (\\trowd…)">⊞
          </button>
          {showTable && <TablePicker onSelect={handleTable} onClose={() => setShowTable(false)} />}
        </div>

        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleImage}
          disabled={disabled} title="Insert image placeholder">🖼</button>
        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleHR}
          disabled={disabled} title="Horizontal rule (\\brdrb\\brdrs)">—</button>

        <button className={btnClass(showFormattingMarks)} onMouseDown={noFocus}
          onClick={() => setShowFormattingMarks((v) => !v)}
          disabled={disabled} title="Toggle formatting marks">¶
        </button>

        {sep}

        <select className="ctx-select" value={activeStyle}
          onChange={(e) => handleStyle(e.target.value)}
          disabled={disabled} title="Quick style" style={{ width: 70 }}>
          {RTF_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleClearFormatting}
          disabled={disabled} title="Clear formatting (strips RTF groups from selection)">
          × fmt
        </button>

      </div>
    </div>
  );
}
