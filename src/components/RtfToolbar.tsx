import { useState, useRef, useEffect } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONTS = [
  'Arial', 'Segoe UI', 'Times New Roman', 'Georgia', 'Calibri',
  'Verdana', 'Tahoma', 'Trebuchet MS', 'Courier New', 'Consolas',
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72];

const RTF_STYLES = [
  'Normal', 'Heading 1', 'Heading 2', 'Heading 3',
  'Title', 'Subtitle', 'Quote', 'Code',
];

const SWATCH_COLORS = [
  '#000000', '#808080', '#C0C0C0', '#FFFFFF', '#FF0000',
  '#800000', '#FF8000', '#808000', '#FFFF00', '#00FF00',
  '#008000', '#00FFFF', '#008080', '#0000FF', '#000080',
  '#FF00FF', '#800080', '#FF69B4', '#8B4513', '#FFA500',
];

// ─── execCommand wrapper ──────────────────────────────────────────────────────

const exec = (cmd: string, value?: string) =>
  document.execCommand(cmd, false, value ?? undefined);

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

// ─── RtfToolbar ───────────────────────────────────────────────────────────────

interface Props {
  disabled: boolean;
  wideMargins: boolean;
  onToggleWideMargins: () => void;
}

export function RtfToolbar({ disabled, wideMargins, onToggleWideMargins }: Props) {
  const [isBold,      setIsBold]      = useState(false);
  const [isItalic,    setIsItalic]    = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike,    setIsStrike]    = useState(false);
  const [activeStyle, setActiveStyle] = useState('Normal');
  const [activeFont,  setActiveFont]  = useState('Arial');
  const [activeSize,  setActiveSize]  = useState(12);
  const [showFontColor,  setShowFontColor]  = useState(false);
  const [showHighlight,  setShowHighlight]  = useState(false);

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

  // Prevent focus theft — toolbar buttons must not steal focus from the editor
  const noFocus = (e: React.MouseEvent) => e.preventDefault();

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleStyle(style: string) {
    switch (style) {
      case 'Heading 1':  exec('formatBlock', 'h1'); break;
      case 'Heading 2':  exec('formatBlock', 'h2'); break;
      case 'Heading 3':  exec('formatBlock', 'h3'); break;
      case 'Title':      exec('formatBlock', 'h1'); exec('fontSize', '7'); break;
      case 'Subtitle':   exec('formatBlock', 'h2'); exec('italic'); break;
      case 'Quote':      exec('formatBlock', 'blockquote'); break;
      case 'Code':       exec('formatBlock', 'pre'); break;
      default:           exec('formatBlock', 'p'); break;
    }
    setActiveStyle(style);
  }

  function handleFont(font: string) {
    setActiveFont(font);
    exec('fontName', font);
  }

  function handleSize(size: number) {
    setActiveSize(size);
    // execCommand fontSize accepts 1–7; map point sizes roughly
    const level = size <= 10 ? 1 : size <= 13 ? 2 : size <= 16 ? 3
                : size <= 18 ? 4 : size <= 24 ? 5 : size <= 32 ? 6 : 7;
    exec('fontSize', String(level));
  }

  function handleAlign(cmd: string) { exec(cmd); }

  function handleTable() {
    const tableHtml = `
      <table>
        <tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr>
        <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
      </table><p><br></p>`;
    exec('insertHTML', tableHtml);
  }

  function handleLink() {
    const url = prompt('Enter URL:');
    if (url) exec('createLink', url);
  }

  // ── JSX helpers ────────────────────────────────────────────────────────────
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

        <button className={btnClass(isBold)} onMouseDown={noFocus}
          onClick={() => exec('bold')} disabled={disabled} title="Bold">
          <strong>B</strong>
        </button>
        <button className={btnClass(isItalic)} onMouseDown={noFocus}
          onClick={() => exec('italic')} disabled={disabled} title="Italic">
          <em>I</em>
        </button>
        <button className={btnClass(isUnderline)} onMouseDown={noFocus}
          onClick={() => exec('underline')} disabled={disabled} title="Underline">
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>
        <button className={btnClass(isStrike)} onMouseDown={noFocus}
          onClick={() => exec('strikeThrough')} disabled={disabled} title="Strikethrough">
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
          disabled={disabled} title="Font size" style={{ width: 50 }}>
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {sep}

        <div style={{ position: 'relative' }}>
          <button className="ctx-btn" onMouseDown={noFocus}
            onClick={() => { setShowFontColor((v) => !v); setShowHighlight(false); }}
            disabled={disabled} title="Font color">
            <span style={{ borderBottom: '2px solid var(--accent)' }}>A</span>
          </button>
          {showFontColor && (
            <ColorSwatch
              onSelect={(c) => exec('foreColor', c)}
              onClose={() => setShowFontColor(false)}
            />
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button className="ctx-btn" onMouseDown={noFocus}
            onClick={() => { setShowHighlight((v) => !v); setShowFontColor(false); }}
            disabled={disabled} title="Highlight color">
            <span style={{ background: '#FFFF00', color: '#000', padding: '0 2px', fontSize: 9 }}>ab</span>
          </button>
          {showHighlight && (
            <ColorSwatch
              onSelect={(c) => exec('hiliteColor', c)}
              onClose={() => setShowHighlight(false)}
            />
          )}
        </div>

        {sep}

        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => handleAlign('justifyLeft')} disabled={disabled} title="Align left">⬤≡</button>
        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => handleAlign('justifyCenter')} disabled={disabled} title="Align center">≡</button>
        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => handleAlign('justifyRight')} disabled={disabled} title="Align right">≡⬤</button>
        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => handleAlign('justifyFull')} disabled={disabled} title="Justify">≡≡</button>

      </div>

      {/* ── Row 2 ──────────────────────────────────────────────────────────── */}
      <div className="ctx-toolbar-row">

        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => exec('insertUnorderedList')} disabled={disabled} title="Bullet list">•≡</button>
        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => exec('insertOrderedList')} disabled={disabled} title="Numbered list">1.</button>

        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => exec('indent')} disabled={disabled} title="Increase indent">→</button>
        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => exec('outdent')} disabled={disabled} title="Decrease indent">←</button>

        {sep}

        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={handleTable} disabled={disabled} title="Insert table">⊞</button>

        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => exec('insertHorizontalRule')} disabled={disabled} title="Horizontal rule">—</button>

        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={handleLink} disabled={disabled} title="Insert link">🔗</button>

        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => exec('unlink')} disabled={disabled} title="Remove link">⛓</button>

        {sep}

        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => exec('removeFormat')} disabled={disabled} title="Clear formatting">× fmt</button>

        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => exec('undo')} disabled={disabled} title="Undo">↩</button>
        <button className="ctx-btn" onMouseDown={noFocus}
          onClick={() => exec('redo')} disabled={disabled} title="Redo">↪</button>

        {sep}

        <button className={btnClass(wideMargins)} onMouseDown={noFocus}
          onClick={onToggleWideMargins} disabled={disabled} title="Wide margins">⟷</button>

      </div>
    </div>
  );
}
