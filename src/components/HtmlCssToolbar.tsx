import { useState, useRef, useEffect } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { getText, apply, wrapSel, hasSel, getSel, replaceSel } from '../utils/toolbarUtils';

interface StatusMsg { text: string; type: 'success' | 'error'; }
interface Props {
  editorRef: React.RefObject<NoteEditorRef | null>;
  disabled: boolean;
  htmlPreviewOpen: boolean;
  onHtmlPreviewToggle: () => void;
  showInvisibles: boolean;
  onToggleInvisibles: () => void;
}

// Basic emmet expansion for common patterns
function expandEmmet(abbr: string): string {
  // ul>li*3
  const childRepeat = abbr.match(/^(\w[\w.#-]*)\*(\d+)$/);
  if (childRepeat) {
    const [, tag, n] = childRepeat;
    const t = expandEmmet(tag);
    return Array.from({ length: parseInt(n) }, () => t).join('\n');
  }
  // div>ul>li
  const parentChild = abbr.match(/^(.+?)>(.+)$/);
  if (parentChild) {
    const [, parent, rest] = parentChild;
    const [tag, ...parts] = parent.match(/^(\w+)(.*)$/) ?? [parent, parent, ''];
    const cls = parts.join('').replace(/\.(\w+)/g, ' $1').replace(/#(\w+)/g, '').trim();
    const id = (parent.match(/#(\w+)/) ?? [])[1] ?? '';
    const attrs = [cls ? ` class="${cls}"` : '', id ? ` id="${id}"` : ''].join('');
    return `<${tag}${attrs}>\n  ${expandEmmet(rest)}\n</${tag}>`;
  }
  // div.class#id
  const m = abbr.match(/^(\w+)((?:\.[\w-]+|#[\w-]+)*)$/);
  if (m) {
    const [, tag, mods] = m;
    const classes = [...mods.matchAll(/\.[\w-]+/g)].map(x => x[0].slice(1)).join(' ');
    const id = (mods.match(/#([\w-]+)/) ?? [])[1];
    const attrs = [classes ? ` class="${classes}"` : '', id ? ` id="${id}"` : ''].join('');
    const selfClose = ['br','hr','img','input','meta','link'].includes(tag);
    return selfClose ? `<${tag}${attrs}>` : `<${tag}${attrs}></${tag}>`;
  }
  return `<${abbr}></${abbr}>`;
}

function beautifyHtml(html: string): string {
  let indent = 0;
  const lines: string[] = [];
  const parts = html.replace(/>\s*</g, '>\n<').split('\n');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('</')) indent = Math.max(0, indent - 1);
    lines.push('  '.repeat(indent) + trimmed);
    if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !trimmed.startsWith('<!--')) {
      const tag = (trimmed.match(/^<(\w+)/) ?? [])[1] ?? '';
      const voids = ['br','hr','img','input','meta','link','area','base','col','embed','param','source','track','wbr'];
      if (!voids.includes(tag)) indent++;
    }
    if (trimmed.endsWith('/>') || (trimmed.startsWith('<') && trimmed.endsWith('>') && trimmed.includes('</'))) indent = Math.max(0, indent);
  }
  return lines.join('\n');
}

export function HtmlCssToolbar({ editorRef, disabled, htmlPreviewOpen, onHtmlPreviewToggle, showInvisibles, onToggleInvisibles }: Props) {
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const [emmetInput, setEmmetInput] = useState('');
  const [showEmmet, setShowEmmet] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emmetRef = useRef<HTMLInputElement>(null);

  function showStatus(text: string, type: 'success' | 'error', duration = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ text, type }); timerRef.current = setTimeout(() => setStatus(null), duration);
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  useEffect(() => { if (showEmmet) emmetRef.current?.focus(); }, [showEmmet]);

  function ins(t: string) { editorRef.current?.replaceSelection(t); }

  function handleEmmetExpand() {
    if (!emmetInput.trim()) { setShowEmmet(false); return; }
    try {
      ins(expandEmmet(emmetInput.trim()));
    } catch { showStatus('Emmet expansion failed', 'error', 3000); }
    setEmmetInput(''); setShowEmmet(false);
  }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      {status && <div className={`ctx-status-banner ctx-status-${status.type}`}>{status.text}</div>}
      {/* Row 1 — HTML */}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '<!-- ', ' -->', 'comment')} disabled={disabled} title="HTML comment">&lt;!-- --&gt;</button>
        <button className="ctx-btn" onClick={() => {
          if (hasSel(editorRef)) replaceSel(editorRef, getSel(editorRef).replace(/<!--\s*([\s\S]*?)\s*-->/g, '$1'));
          else apply(editorRef, getText(editorRef).replace(/<!--\s*([\s\S]*?)\s*-->/g, '$1'));
        }} disabled={disabled} title="Remove HTML comments">Uncomment</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('<div>\n  \n</div>')} disabled={disabled} title="Insert div">div</button>
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '<span>', '</span>')} disabled={disabled} title="span">span</button>
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '<p>', '</p>')} disabled={disabled} title="paragraph">p</button>
        <button className="ctx-btn" onClick={() => ins('<a href="">\n  \n</a>')} disabled={disabled} title="anchor">a</button>
        {sep}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button className="ctx-btn" onClick={() => setShowEmmet(v => !v)} disabled={disabled} title="Expand Emmet abbreviation">Emmet</button>
          {showEmmet && (
            <input
              ref={emmetRef}
              className="ctx-inline-input"
              placeholder="div.class>span*3"
              value={emmetInput}
              onChange={e => setEmmetInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEmmetExpand(); if (e.key === 'Escape') setShowEmmet(false); }}
              onBlur={() => setShowEmmet(false)}
              style={{ width: 140 }}
            />
          )}
        </div>
        {sep}
        <button className="ctx-btn" onClick={() => apply(editorRef, beautifyHtml(getText(editorRef)))} disabled={disabled} title="Beautify HTML">Beautify</button>
        <button className="ctx-btn" onClick={() => apply(editorRef, getText(editorRef).replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim())} disabled={disabled} title="Minify HTML">Minify</button>
        {sep}
        <button
          className={`ctx-btn${htmlPreviewOpen ? ' ctx-btn-active' : ''}`}
          onClick={onHtmlPreviewToggle}
          disabled={disabled}
          title="Toggle inline HTML preview (split view)"
        >Preview</button>
      </div>
      {/* Row 2 — CSS */}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '/* ', ' */', 'comment')} disabled={disabled} title="CSS block comment">/* Comment */</button>
        <button className="ctx-btn" onClick={() => {
          if (hasSel(editorRef)) replaceSel(editorRef, getSel(editorRef).replace(/\/\*\s?([\s\S]*?)\s?\*\//g, '$1'));
          else apply(editorRef, getText(editorRef).replace(/\/\*\s?([\s\S]*?)\s?\*\//g, '$1'));
        }} disabled={disabled} title="Remove CSS comments">Uncomment</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('.container {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex-direction: row;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n')} disabled={disabled} title="Flexbox template">Flex</button>
        <button className="ctx-btn" onClick={() => ins('.container {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 16px;\n}\n')} disabled={disabled} title="CSS Grid template">Grid</button>
        <button className="ctx-btn" onClick={() => ins('@media screen and (max-width: 768px) {\n  \n}\n')} disabled={disabled} title="Media query template">@media</button>
        {sep}
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (sel) replaceSel(editorRef, `-webkit-${sel};\n-moz-${sel};\n${sel}`);
          else ins('-webkit-property: value;\n-moz-property: value;\nproperty: value;\n');
        }} disabled={disabled} title="Add vendor prefixes">Prefix</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('color: var(--accent-color);\n')} disabled={disabled} title="CSS variable template">var()</button>
        <button className="ctx-btn" onClick={() => ins(':root {\n  --variable-name: value;\n}\n')} disabled={disabled} title=":root variables">:root</button>
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
}
