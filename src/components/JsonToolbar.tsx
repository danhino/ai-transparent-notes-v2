import { useState, useRef, useEffect, memo } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { getText, getSel, hasSel, apply, replaceSel, wrapSel, copyText } from '../utils/toolbarUtils';

interface StatusMsg { text: string; type: 'success' | 'error'; }
interface Props {
  editorRef: React.RefObject<NoteEditorRef | null>;
  disabled: boolean;
  previewOpen: boolean;
  onPreviewToggle: () => void;
  showInvisibles: boolean;
  onToggleInvisibles: () => void;
}

function sortKeysDeep(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(sortKeysDeep);
  if (val && typeof val === 'object') {
    return Object.keys(val as object).sort().reduce((acc, k) => {
      (acc as Record<string, unknown>)[k] = sortKeysDeep((val as Record<string, unknown>)[k]);
      return acc;
    }, {} as object);
  }
  return val;
}

function flattenObj(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(acc, flattenObj(v as Record<string, unknown>, key));
    } else {
      acc[key] = v;
    }
    return acc;
  }, {} as Record<string, unknown>);
}

function unflattenObj(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const parts = key.split('.');
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = val;
  }
  return result;
}

function getJsonPathAtOffset(json: string, offset: number): string {
  const path: string[] = [];
  let i = 0; let inStr = false; let esc = false;
  let pendingKey = ''; let inKey = false; let expectColon = false;
  while (i < Math.min(offset, json.length)) {
    const ch = json[i];
    if (esc) { esc = false; if (inKey && inStr) pendingKey += ch; i++; continue; }
    if (ch === '\\' && inStr) { esc = true; i++; continue; }
    if (ch === '"') {
      if (!inStr) { inStr = true; pendingKey = ''; inKey = !expectColon; }
      else { inStr = false; if (!inKey) { /* value string */ } }
      i++; continue;
    }
    if (inStr) { if (inKey) pendingKey += ch; i++; continue; }
    if (ch === '{') { path.push(pendingKey || ''); pendingKey = ''; expectColon = false; }
    else if (ch === '[') { path.push('[0]'); }
    else if (ch === '}' || ch === ']') { path.pop(); }
    else if (ch === ':') { path[path.length - 1] = pendingKey; pendingKey = ''; expectColon = false; inKey = false; }
    else if (ch === ',') { expectColon = true; inKey = false; }
    i++;
  }
  return path.filter(Boolean).join('.').replace(/\.\[/g, '[');
}

export const JsonToolbar = memo(function JsonToolbar({ editorRef, disabled, previewOpen, onPreviewToggle, showInvisibles, onToggleInvisibles }: Props) {
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showStatus(text: string, type: 'success' | 'error', duration = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ text, type });
    timerRef.current = setTimeout(() => setStatus(null), duration);
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function tryParse(): unknown | null {
    try { return JSON.parse(getText(editorRef)); }
    catch (e) { showStatus((e as Error).message, 'error', 6000); return null; }
  }

  function handlePrettyPrint() {
    const parsed = tryParse(); if (parsed === null) return;
    apply(editorRef, JSON.stringify(parsed, null, 2));
    showStatus('Formatted', 'success', 2000);
  }

  function handleMinify() {
    const parsed = tryParse(); if (parsed === null) return;
    apply(editorRef, JSON.stringify(parsed));
    showStatus('Minified', 'success', 2000);
  }

  function handleValidate() {
    try { JSON.parse(getText(editorRef)); showStatus('Valid JSON', 'success', 3000); }
    catch (e) { showStatus((e as Error).message, 'error', 8000); }
  }

  function handleSortKeys() {
    const parsed = tryParse(); if (parsed === null) return;
    const indented = getText(editorRef).match(/\n  /) ? 2 : 0;
    apply(editorRef, JSON.stringify(sortKeysDeep(parsed), null, indented || undefined));
    showStatus('Keys sorted', 'success', 2000);
  }

  function handleFlatten() {
    const parsed = tryParse();
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) { showStatus('Must be an object', 'error', 3000); return; }
    apply(editorRef, JSON.stringify(flattenObj(parsed as Record<string, unknown>), null, 2));
    showStatus('Flattened', 'success', 2000);
  }

  function handleUnflatten() {
    const parsed = tryParse();
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) { showStatus('Must be an object', 'error', 3000); return; }
    apply(editorRef, JSON.stringify(unflattenObj(parsed as Record<string, unknown>), null, 2));
    showStatus('Unflattened', 'success', 2000);
  }

  function handleCopyPath() {
    const offset = editorRef.current?.getCursorOffset() ?? 0;
    const path = getJsonPathAtOffset(getText(editorRef), offset);
    void copyText(path || '(root)').then(() => showStatus('Path copied', 'success', 2000));
  }

  function handleBlockComment() { wrapSel(editorRef, '/* ', ' */', 'comment'); }
  function handleUncomment() {
    if (hasSel(editorRef)) { replaceSel(editorRef, getSel(editorRef).replace(/\/\*\s?([\s\S]*?)\s?\*\//g, '$1')); }
    else { apply(editorRef, getText(editorRef).replace(/\/\*\s?([\s\S]*?)\s?\*\//g, '$1')); }
  }

  function handleWrapArray() {
    const t = getText(editorRef).trim();
    if (t.startsWith('[')) { showStatus('Already an array', 'success', 2000); return; }
    apply(editorRef, `[\n${t}\n]`);
    showStatus('Wrapped in array', 'success', 2000);
  }
  function handleWrapObject() {
    const t = getText(editorRef).trim();
    if (t.startsWith('{')) { showStatus('Already an object', 'success', 2000); return; }
    apply(editorRef, `{\n${t}\n}`);
    showStatus('Wrapped in object', 'success', 2000);
  }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      {status && <div className={`ctx-status-banner ctx-status-${status.type}`}>{status.text}</div>}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={handlePrettyPrint} disabled={disabled} title="Format JSON with 2-space indent">Pretty print</button>
        <button className="ctx-btn" onClick={handleMinify} disabled={disabled} title="Remove all whitespace">Minify</button>
        <button className="ctx-btn" onClick={handleValidate} disabled={disabled} title="Validate JSON syntax">✓ Validate</button>
        <button
          className={`ctx-btn${previewOpen ? ' ctx-btn-active' : ''}`}
          onClick={onPreviewToggle}
          disabled={disabled}
          title="Toggle JSON tree explorer view"
        >Preview</button>
        {sep}
        <button className="ctx-btn" onClick={handleSortKeys} disabled={disabled} title="Sort all object keys alphabetically">Sort keys</button>
        <button className="ctx-btn" onClick={handleFlatten} disabled={disabled} title="Flatten nested to dot notation">Flatten</button>
        <button className="ctx-btn" onClick={handleUnflatten} disabled={disabled} title="Unflatten dot notation to nested">Unflatten</button>
        {sep}
        <button className="ctx-btn" onClick={handleCopyPath} disabled={disabled} title="Copy JSON path at cursor">Copy path</button>
      </div>
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={handleBlockComment} disabled={disabled} title="Wrap selection in /* */">/* Comment */</button>
        <button className="ctx-btn" onClick={handleUncomment} disabled={disabled} title="Remove /* */ markers">Uncomment</button>
        {sep}
        <button className="ctx-btn" onClick={handleWrapArray} disabled={disabled} title="Wrap content in [ ]">[ ] Array</button>
        <button className="ctx-btn" onClick={handleWrapObject} disabled={disabled} title="Wrap content in { }">&#123; &#125; Object</button>
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
});
