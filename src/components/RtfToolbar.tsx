import { useState, useRef, useEffect } from 'react';
import type { RichTextEditorRef } from './RichTextEditor';

const FONTS = [
  'Segoe UI', 'Consolas', 'Cascadia Code', 'Courier New', 'Georgia',
  'Times New Roman', 'Calibri', 'Arial', 'Verdana', 'Tahoma',
  'Trebuchet MS', 'Comic Sans MS',
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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ColorSwatchProps { onSelect: (c: string) => void; onClose: () => void; }

function ColorSwatch({ onSelect, onClose }: ColorSwatchProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
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
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="table-picker-popup">
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {hover.r > 0 ? `${hover.r} x ${hover.c}` : 'Select table size'}
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
  editorRef: React.RefObject<RichTextEditorRef | null>;
  disabled: boolean;
}

export function RtfToolbar({ editorRef, disabled }: Props) {
  const [activeStyle, setActiveStyle] = useState('Normal');
  const [activeFont,  setActiveFont]  = useState('Segoe UI');
  const [activeSize,  setActiveSize]  = useState(12);
  const [isBold,      setIsBold]      = useState(false);
  const [isItalic,    setIsItalic]    = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike,    setIsStrike]    = useState(false);
  const [alignment,   setAlignment]   = useState<'left'|'center'|'right'|'justify'>('left');
  const [showFontColor,        setShowFontColor]        = useState(false);
  const [showHighlight,        setShowHighlight]        = useState(false);
  const [showTable,            setShowTable]            = useState(false);
  const [showFormattingMarks,  setShowFormattingMarks]  = useState(false);
  const [showBullets,          setShowBullets]          = useState(false);
  const [showNumbers,          setShowNumbers]          = useState(false);

  // Mirror the browser's format state whenever the selection moves
  useEffect(() => {
    function sync() {
      if (disabled) return;
      setIsBold(document.queryCommandState('bold'));
      setIsItalic(document.queryCommandState('italic'));
      setIsUnderline(document.queryCommandState('underline'));
      setIsStrike(document.queryCommandState('strikeThrough'));
    }
    document.addEventListener('selectionchange', sync);
    return () => document.removeEventListener('selectionchange', sync);
  }, [disabled]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const ed = () => editorRef.current;
  const exec = (cmd: string, val?: string) => ed()?.execFormat(cmd, val);

  // Prevent focus theft so the editor keeps its selection when a button is clicked
  const noFocus = (e: React.MouseEvent) => e.preventDefault();

  // ── Formatting handlers ────────────────────────────────────────────────────
  function handleBold()      { exec('bold'); }
  function handleItalic()    { exec('italic'); }
  function handleUnderline() { exec('underline'); }
  function handleStrike()    { exec('strikeThrough'); }

  function handleStyle(style: string) {
    ed()?.focus();
    switch (style) {
      case 'Heading 1': exec('formatBlock', 'h1'); break;
      case 'Heading 2': exec('formatBlock', 'h2'); break;
      case 'Heading 3': exec('formatBlock', 'h3'); break;
      case 'Title':     exec('bold'); exec('fontSize', '6'); break;
      case 'Subtitle':  exec('italic'); exec('fontSize', '4'); break;
      case 'Quote':     exec('formatBlock', 'blockquote'); break;
      case 'Code':      exec('formatBlock', 'pre'); break;
      default:          exec('formatBlock', 'p'); break;
    }
    setActiveStyle(style);
  }

  function handleFont(font: string) {
    setActiveFont(font);
    exec('fontName', font);
  }

  function handleSize(size: number) {
    setActiveSize(size);
    // execCommand fontSize takes 1–7; map px roughly
    const level = size <= 10 ? 1 : size <= 13 ? 2 : size <= 16 ? 3 : size <= 18 ? 4 : size <= 24 ? 5 : size <= 32 ? 6 : 7;
    exec('fontSize', String(level));
  }

  function handleAlign(align: 'left'|'center'|'right'|'justify') {
    const cmd = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' }[align];
    exec(cmd);
    setAlignment(align);
  }

  function handleBulletList() {
    exec('insertUnorderedList');
    setShowBullets((v) => !v);
  }

  function handleNumberedList() {
    exec('insertOrderedList');
    setShowNumbers((v) => !v);
  }

  function handleIndent(increase: boolean) {
    exec(increase ? 'indent' : 'outdent');
  }

  function handleHR() {
    ed()?.insertHTML('<hr style="border:1px solid var(--border);margin:8px 0;">');
  }

  function handleTable(rows: number, cols: number) {
    let html = '<table border="1" style="border-collapse:collapse;width:100%;">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td style="padding:4px 8px;min-width:60px;">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</table><br>';
    ed()?.insertHTML(html);
  }

  function handleImage() {
    ed()?.insertHTML('<br>[Image placeholder]<br>');
  }

  function handleClearFormatting() {
    exec('removeFormat');
    setIsBold(false); setIsItalic(false); setIsUnderline(false); setIsStrike(false);
  }

  function handleColorSelect(color: string) {
    exec('foreColor', color);
  }

  function handleHighlightSelect(color: string) {
    exec('hiliteColor', color);
  }

  // ── JSX ────────────────────────────────────────────────────────────────────
  const sep = <div className="ctx-toolbar-sep" />;
  const btnClass = (active: boolean) => `ctx-btn${active ? ' ctx-btn-active' : ''}`;

  return (
    <div className="contextual-toolbar">

      {/* ── Row 1 ─────────────────────────────────────────────────────────── */}
      <div className="ctx-toolbar-row">

        <select className="ctx-select" value={activeStyle}
          onChange={(e) => handleStyle(e.target.value)}
          disabled={disabled} title="Paragraph style">
          {RTF_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {sep}

        <button className={btnClass(isBold)}      onMouseDown={noFocus} onClick={handleBold}      disabled={disabled} title="Bold">      <strong>B</strong></button>
        <button className={btnClass(isItalic)}    onMouseDown={noFocus} onClick={handleItalic}    disabled={disabled} title="Italic">    <em>I</em></button>
        <button className={btnClass(isUnderline)} onMouseDown={noFocus} onClick={handleUnderline} disabled={disabled} title="Underline"> <span style={{ textDecoration: 'underline' }}>U</span></button>
        <button className={btnClass(isStrike)}    onMouseDown={noFocus} onClick={handleStrike}    disabled={disabled} title="Strikethrough"><span style={{ textDecoration: 'line-through' }}>S</span></button>

        {sep}

        <select className="ctx-select" value={activeFont}
          onChange={(e) => handleFont(e.target.value)}
          disabled={disabled} title="Font family" style={{ maxWidth: 110 }}>
          {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <select className="ctx-select" value={activeSize}
          onChange={(e) => handleSize(Number(e.target.value))}
          disabled={disabled} title="Font size" style={{ width: 50 }}>
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {sep}

        <div style={{ position: 'relative' }}>
          <button className="ctx-btn" onMouseDown={noFocus}
            onClick={() => { setShowFontColor((v) => !v); setShowHighlight(false); setShowTable(false); }}
            disabled={disabled} title="Font color">
            <span style={{ borderBottom: '2px solid var(--accent)' }}>A</span>
          </button>
          {showFontColor && <ColorSwatch onSelect={handleColorSelect} onClose={() => setShowFontColor(false)} />}
        </div>

        <div style={{ position: 'relative' }}>
          <button className="ctx-btn" onMouseDown={noFocus}
            onClick={() => { setShowHighlight((v) => !v); setShowFontColor(false); setShowTable(false); }}
            disabled={disabled} title="Highlight color">
            <span style={{ background: '#FFFF00', color: '#000', padding: '0 2px', fontSize: 9 }}>ab</span>
          </button>
          {showHighlight && <ColorSwatch onSelect={handleHighlightSelect} onClose={() => setShowHighlight(false)} />}
        </div>

        {sep}

        {(['left', 'center', 'right', 'justify'] as const).map((a) => (
          <button key={a} className={btnClass(alignment === a)} onMouseDown={noFocus}
            onClick={() => handleAlign(a)} disabled={disabled} title={`Align ${a}`}>
            {a === 'left' ? '⬤≡' : a === 'center' ? '≡' : a === 'right' ? '≡⬤' : '≡≡'}
          </button>
        ))}
      </div>

      {/* ── Row 2 ─────────────────────────────────────────────────────────── */}
      <div className="ctx-toolbar-row">

        <select className="ctx-select" disabled={disabled} title="Margin" style={{ width: 80 }}>
          {MARGIN_OPTIONS.map((m) => <option key={m}>{m}</option>)}
        </select>

        <button className="ctx-btn" onMouseDown={noFocus} onClick={() => handleIndent(true)}  disabled={disabled} title="Increase indent">→</button>
        <button className="ctx-btn" onMouseDown={noFocus} onClick={() => handleIndent(false)} disabled={disabled} title="Decrease indent">←</button>

        <select className="ctx-select" disabled={disabled} title="Page size" style={{ width: 62 }}>
          {PAGE_SIZES.map((p) => <option key={p}>{p}</option>)}
        </select>

        {sep}

        <button className={btnClass(showBullets)} onMouseDown={noFocus} onClick={handleBulletList}    disabled={disabled} title="Bullet list">•≡</button>
        <button className={btnClass(showNumbers)} onMouseDown={noFocus} onClick={handleNumberedList}  disabled={disabled} title="Numbered list">1.</button>

        <div style={{ position: 'relative' }}>
          <button className="ctx-btn" onMouseDown={noFocus}
            onClick={() => { setShowTable((v) => !v); setShowFontColor(false); setShowHighlight(false); }}
            disabled={disabled} title="Insert table">⊞
          </button>
          {showTable && <TablePicker onSelect={handleTable} onClose={() => setShowTable(false)} />}
        </div>

        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleImage} disabled={disabled} title="Insert image placeholder">🖼</button>
        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleHR}    disabled={disabled} title="Insert horizontal rule">—</button>

        <button className={btnClass(showFormattingMarks)} onMouseDown={noFocus}
          onClick={() => setShowFormattingMarks((v) => !v)}
          disabled={disabled} title="Show/hide formatting marks">¶
        </button>

        {sep}

        <select className="ctx-select" value={activeStyle}
          onChange={(e) => handleStyle(e.target.value)}
          disabled={disabled} title="Quick style" style={{ width: 70 }}>
          {RTF_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <button className="ctx-btn" onMouseDown={noFocus} onClick={handleClearFormatting}
          disabled={disabled} title="Clear formatting">× fmt
        </button>
      </div>
    </div>
  );
}
