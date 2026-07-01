import { useState, useRef, useEffect, memo } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { getText, apply, getSel, hasSel, replaceSel } from '../utils/toolbarUtils';

interface StatusMsg { text: string; type: 'success' | 'error'; }
interface Props {
  editorRef: React.RefObject<NoteEditorRef | null>;
  disabled: boolean;
  showInvisibles: boolean;
  onToggleInvisibles: () => void;
}

function beautifyCss(css: string): string {
  let depth = 0;
  const result: string[] = [];

  // Normalize braces and semicolons into discrete lines.
  // ;[ \t]* avoids splitting newlines that already exist after semicolons.
  const normalized = css
    .replace(/\s*\{\s*/g, ' {\n')
    .replace(/\s*\}\s*/g, '\n}\n')
    .replace(/;[ \t]*/g, ';\n');

  for (const raw of normalized.split('\n')) {
    const t = raw.trim();
    if (!t) continue;

    if (t === '}') {
      depth = Math.max(0, depth - 1);
      result.push('  '.repeat(depth) + '}');
      // Blank line after every top-level closing brace separates rule blocks.
      if (depth === 0) result.push('');
    } else if (t.endsWith('{')) {
      result.push('  '.repeat(depth) + t);
      depth++;
    } else {
      result.push('  '.repeat(depth) + t);
    }
  }

  // Collapse runs of 3+ newlines to 2, trim trailing whitespace.
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*\{\s*/g, '{')
    .replace(/\s*\}\s*/g, '}')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*,\s*/g, ',')
    .replace(/\n/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const CssToolbar = memo(function CssToolbar({ editorRef, disabled, showInvisibles, onToggleInvisibles }: Props) {
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showStatus(text: string, type: 'success' | 'error', duration = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ text, type });
    timerRef.current = setTimeout(() => setStatus(null), duration);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function ins(t: string) { editorRef.current?.replaceSelection(t); }

  function handleBeautify() {
    apply(editorRef, beautifyCss(getText(editorRef)));
    showStatus('Beautified', 'success', 2000);
  }

  function handleMinify() {
    apply(editorRef, minifyCss(getText(editorRef)));
    showStatus('Minified', 'success', 2000);
  }

  function handleComment() {
    const sel = getSel(editorRef);
    if (sel) replaceSel(editorRef, `/* ${sel} */`);
    else ins('/* comment */');
  }

  function handleUncomment() {
    if (hasSel(editorRef)) {
      replaceSel(editorRef, getSel(editorRef).replace(/\/\*\s?([\s\S]*?)\s?\*\//g, '$1'));
    } else {
      apply(editorRef, getText(editorRef).replace(/\/\*\s?([\s\S]*?)\s?\*\//g, '$1'));
    }
  }

  const sep = <div className="ctx-toolbar-sep" />;

  return (
    <div className="contextual-toolbar">
      {status && <div className={`ctx-status-banner ctx-status-${status.type}`}>{status.text}</div>}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={handleBeautify} disabled={disabled} title="Expand minified CSS into readable form with 2-space indent">Beautify</button>
        <button className="ctx-btn" onClick={handleMinify} disabled={disabled} title="Collapse CSS to single line, strip comments">Minify</button>
        {sep}
        <button className="ctx-btn" onClick={handleComment} disabled={disabled} title="Wrap selection in CSS block comment">/* Comment */</button>
        <button className="ctx-btn" onClick={handleUncomment} disabled={disabled} title="Remove CSS block comments">Uncomment</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('color: var(--variable-name);\n')} disabled={disabled} title="CSS variable reference">var()</button>
        <button className="ctx-btn" onClick={() => ins(':root {\n  --variable-name: value;\n}\n')} disabled={disabled} title="Define CSS custom properties">:root</button>
        <button className="ctx-btn" onClick={() => ins('.container {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex-direction: row;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n')} disabled={disabled} title="Flexbox template">Flex</button>
        <button className="ctx-btn" onClick={() => ins('.container {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 16px;\n}\n')} disabled={disabled} title="CSS Grid template">Grid</button>
        <button className="ctx-btn" onClick={() => ins('@media screen and (max-width: 768px) {\n  \n}\n')} disabled={disabled} title="Responsive media query">@media</button>
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (sel) replaceSel(editorRef, `-webkit-${sel};\n-moz-${sel};\n${sel}`);
          else ins('-webkit-property: value;\n-moz-property: value;\nproperty: value;\n');
        }} disabled={disabled} title="Add vendor prefixes to selected property">Prefix</button>
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
});
