import { useState, useRef, useEffect, memo } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import {
  formatXml,
  minifyXml,
  validateXml,
  unwrapTag,
  insertAtOffset,
  xpathSearch,
} from '../utils/xmlUtils';

interface StatusMsg {
  text: string;
  type: 'success' | 'error';
}

interface InlineInputProps {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function InlineInput({ placeholder, value, onChange, onCommit, onCancel }: InlineInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <input
      ref={ref}
      className="ctx-inline-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit();
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={onCancel}
    />
  );
}

interface Props {
  editorRef: React.RefObject<NoteEditorRef | null>;
  disabled: boolean;
  showInvisibles: boolean;
  onToggleInvisibles: () => void;
}

export const XmlToolbar = memo(function XmlToolbar({ editorRef, disabled, showInvisibles, onToggleInvisibles }: Props) {
  const [showWrapInput, setShowWrapInput] = useState(false);
  const [wrapTagName, setWrapTagName] = useState('');
  const [xpathQuery, setXpathQuery] = useState('');
  const [xpathCount, setXpathCount] = useState<number | null>(null);
  const [showAttrInput, setShowAttrInput] = useState(false);
  const [attrName, setAttrName] = useState('');
  const [attrValue, setAttrValue] = useState('');
  const [showChildInput, setShowChildInput] = useState(false);
  const [childTag, setChildTag] = useState('');
  const [showSiblingInput, setShowSiblingInput] = useState(false);
  const [siblingTag, setSiblingTag] = useState('');
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showStatus(text: string, type: 'success' | 'error', duration = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ text, type });
    timerRef.current = setTimeout(() => setStatus(null), duration);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function getText() { return editorRef.current?.getText() ?? ''; }
  function getSel() { return editorRef.current?.getSelection() ?? ''; }
  function getCursor() { return editorRef.current?.getCursorOffset() ?? 0; }
  function apply(text: string) { editorRef.current?.applyText(text); }

  function handleFormat() {
    const { result, error } = formatXml(getText());
    apply(result);
    if (error) showStatus(error, 'error');
    else showStatus('Formatted', 'success', 2000);
  }

  function handleMinify() {
    const { result, error } = minifyXml(getText());
    apply(result);
    if (error) showStatus(error, 'error');
    else showStatus('Minified', 'success', 2000);
  }

  function handleValidate() {
    const { valid, error } = validateXml(getText());
    if (valid) showStatus('Valid XML', 'success', 3000);
    else showStatus(error ?? 'Invalid XML', 'error', 8000);
  }

  function handleWrapCommit() {
    if (!wrapTagName) { setShowWrapInput(false); return; }
    const sel = getSel();
    const full = getText();
    if (sel) {
      apply(full.replace(sel, `<${wrapTagName}>${sel}</${wrapTagName}>`));
    } else {
      const offset = getCursor();
      apply(insertAtOffset(full, `<${wrapTagName}></${wrapTagName}>`, offset));
    }
    setWrapTagName('');
    setShowWrapInput(false);
  }

  function handleUnwrap() {
    const sel = getSel();
    const full = getText();
    apply(unwrapTag(full, sel));
  }

  function handleAttrCommit() {
    if (!attrName) { setShowAttrInput(false); return; }
    const full = getText();
    const offset = getCursor();
    const tagEnd = full.indexOf('>', offset);
    if (tagEnd >= 0) {
      const insertion = ` ${attrName}="${attrValue}"`;
      const newText = full.slice(0, tagEnd) + insertion + full.slice(tagEnd);
      apply(newText);
    }
    setAttrName(''); setAttrValue('');
    setShowAttrInput(false);
  }

  function handleChildCommit() {
    if (!childTag) { setShowChildInput(false); return; }
    const offset = getCursor();
    const full = getText();
    const innerEnd = full.indexOf('>', offset) + 1;
    if (innerEnd > 0) {
      apply(insertAtOffset(full, `\n  <${childTag}></${childTag}>`, innerEnd));
    }
    setChildTag(''); setShowChildInput(false);
  }

  function handleSiblingCommit() {
    if (!siblingTag) { setShowSiblingInput(false); return; }
    const offset = getCursor();
    const full = getText();
    const closeTag = full.indexOf('</', offset);
    const afterClose = full.indexOf('>', closeTag) + 1;
    if (afterClose > 0) {
      apply(insertAtOffset(full, `\n<${siblingTag}></${siblingTag}>`, afterClose));
    }
    setSiblingTag(''); setShowSiblingInput(false);
  }

  function handleInsertComment() {
    const offset = getCursor();
    apply(insertAtOffset(getText(), '<!-- comment -->', offset));
  }

  function handleInsertCDATA() {
    const offset = getCursor();
    apply(insertAtOffset(getText(), '<![CDATA[ ]]>', offset));
  }

  function handleBlockComment() {
    const sel = getSel();
    const full = getText();
    if (sel) {
      apply(full.replace(sel, `<!-- ${sel} -->`));
    } else {
      const offset = getCursor();
      apply(insertAtOffset(full, '<!-- comment -->', offset));
    }
  }

  function handleUncommentBlock() {
    const full = getText();
    // Remove first <!-- and --> surrounding or inside selection
    const cleaned = full.replace(/<!--\s*([\s\S]*?)\s*-->/g, '$1');
    apply(cleaned);
  }

  function handleCopyXPath() {
    const full = getText();
    const offset = getCursor();
    try {
      const path = getXPathAtOffset(full, offset);
      if (path) {
        void navigator.clipboard.writeText(path).then(() => showStatus('XPath copied', 'success', 2000));
      } else {
        showStatus('No element found at cursor', 'error', 2000);
      }
    } catch {
      showStatus('Parse error', 'error', 2000);
    }
  }

  function getXPathAtOffset(xml: string, offset: number): string | null {
    const stack: string[] = [];
    let i = 0;
    let lastPath: string | null = null;
    while (i < xml.length) {
      if (i >= offset) {
        lastPath = stack.length ? '/' + stack.join('/') : null;
        break;
      }
      if (xml[i] !== '<') { i++; continue; }
      if (xml.slice(i, i + 4) === '<!--') {
        const end = xml.indexOf('-->', i); i = end < 0 ? xml.length : end + 3; continue;
      }
      if (xml[i + 1] === '?') { const end = xml.indexOf('?>', i); i = end < 0 ? xml.length : end + 2; continue; }
      const end = xml.indexOf('>', i);
      if (end < 0) break;
      const tagContent = xml.slice(i + 1, end).trim();
      if (tagContent.startsWith('/')) {
        stack.pop();
      } else if (!tagContent.endsWith('/')) {
        const name = tagContent.split(/[\s/]/)[0];
        if (name) stack.push(name);
      }
      i = end + 1;
    }
    if (lastPath === null && stack.length) lastPath = '/' + stack.join('/');
    return lastPath;
  }

  function handleXpathSearch() {
    if (!xpathQuery) return;
    const { matches, error } = xpathSearch(getText(), xpathQuery);
    if (error) { showStatus(error, 'error'); setXpathCount(null); }
    else setXpathCount(matches.length);
  }

  const sep = <div className="ctx-toolbar-sep" />;

  return (
    <div className="contextual-toolbar">
      {status && (
        <div className={`ctx-status-banner ctx-status-${status.type}`}>
          {status.text}
        </div>
      )}

      {/* Row 1 */}
      <div className="ctx-toolbar-row">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="ctx-btn"
            onClick={() => { setShowWrapInput((v) => !v); setWrapTagName(''); }}
            disabled={disabled}
            title="Wrap selection in tag"
          >
            &lt;&gt; Wrap
          </button>
          {showWrapInput && (
            <InlineInput
              placeholder="tag name"
              value={wrapTagName}
              onChange={setWrapTagName}
              onCommit={handleWrapCommit}
              onCancel={() => setShowWrapInput(false)}
            />
          )}
        </div>

        <button className="ctx-btn" onClick={handleUnwrap} disabled={disabled} title="Remove surrounding tags">
          &lt;/&gt; Unwrap
        </button>

        {sep}

        <button className="ctx-btn" disabled={disabled} title="Collapse all nodes">
          🔼 Collapse all
        </button>
        <button className="ctx-btn" disabled={disabled} title="Expand all nodes">
          🔽 Expand all
        </button>

        {sep}

        <button className="ctx-btn" onClick={handleFormat} disabled={disabled} title="Pretty Print/Format XML (2-space indent)">
          Pretty Print
        </button>
        <button className="ctx-btn" onClick={handleMinify} disabled={disabled} title="Minify XML">
          ⊟ Minify
        </button>

        {sep}

        <button className="ctx-btn" onClick={handleValidate} disabled={disabled} title="Validate XML">
          ✓ Validate
        </button>

        {sep}

        <button className="ctx-btn" onClick={handleBlockComment} disabled={disabled} title="Wrap selection in XML comment">
          &lt;!-- Comment
        </button>
        <button className="ctx-btn" onClick={handleUncommentBlock} disabled={disabled} title="Remove XML comment markers">
          Uncomment
        </button>

        {sep}

        <button className="ctx-btn" onClick={handleCopyXPath} disabled={disabled} title="Copy XPath of element at cursor">
          Copy XPath
        </button>
      </div>

      {/* Row 2 */}
      <div className="ctx-toolbar-row">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="ctx-btn"
            onClick={() => { setShowAttrInput((v) => !v); setAttrName(''); setAttrValue(''); }}
            disabled={disabled}
            title="Add attribute to current element"
          >
            + Attr
          </button>
          {showAttrInput && (
            <>
              <InlineInput
                placeholder="name"
                value={attrName}
                onChange={setAttrName}
                onCommit={handleAttrCommit}
                onCancel={() => setShowAttrInput(false)}
              />
              <InlineInput
                placeholder="value"
                value={attrValue}
                onChange={setAttrValue}
                onCommit={handleAttrCommit}
                onCancel={() => setShowAttrInput(false)}
              />
            </>
          )}
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="ctx-btn"
            onClick={() => { setShowChildInput((v) => !v); setChildTag(''); }}
            disabled={disabled}
            title="Insert child element"
          >
            + Child
          </button>
          {showChildInput && (
            <InlineInput
              placeholder="tag name"
              value={childTag}
              onChange={setChildTag}
              onCommit={handleChildCommit}
              onCancel={() => setShowChildInput(false)}
            />
          )}
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="ctx-btn"
            onClick={() => { setShowSiblingInput((v) => !v); setSiblingTag(''); }}
            disabled={disabled}
            title="Insert sibling element"
          >
            + Sibling
          </button>
          {showSiblingInput && (
            <InlineInput
              placeholder="tag name"
              value={siblingTag}
              onChange={setSiblingTag}
              onCommit={handleSiblingCommit}
              onCancel={() => setShowSiblingInput(false)}
            />
          )}
        </div>

        <button
          className="ctx-btn"
          onClick={handleInsertComment}
          disabled={disabled}
          title="Insert XML comment"
        >
          + Comment
        </button>
        <button
          className="ctx-btn"
          onClick={handleInsertCDATA}
          disabled={disabled}
          title="Insert CDATA section"
        >
          + CDATA
        </button>

        {sep}

        <button className="ctx-btn" disabled={disabled} title="Move to previous sibling">↑ Prev</button>
        <button className="ctx-btn" disabled={disabled} title="Move to next sibling">↓ Next</button>
        <button className="ctx-btn" disabled={disabled} title="Move to parent element">↑↑ Parent</button>

        {sep}

        <input
          className="ctx-inline-input"
          placeholder="XPath expression"
          value={xpathQuery}
          onChange={(e) => { setXpathQuery(e.target.value); if (!e.target.value) setXpathCount(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleXpathSearch(); }}
          disabled={disabled}
          style={{ width: 160 }}
        />
        <button className="ctx-btn" onClick={handleXpathSearch} disabled={disabled || !xpathQuery} title="Run XPath">
          Go
        </button>
        {xpathCount !== null && (
          <span className="ctx-label" style={{ color: xpathCount > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
            {xpathCount} match{xpathCount !== 1 ? 'es' : ''}
          </span>
        )}
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
});
