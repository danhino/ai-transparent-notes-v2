import { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { invoke } from '@tauri-apps/api/core';
import type { NoteEditorRef } from './NoteEditor';
import { getText, getSel, hasSel, replaceSel, wrapSel, addLinePrefix } from '../utils/toolbarUtils';

interface StatusMsg { text: string; type: 'success' | 'error'; }
interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; }

function addLinePrefix1(lines: string, prefix: string) {
  return lines.split('\n').map(l => prefix + l).join('\n');
}

function generateToc(content: string): string {
  const lines = content.split('\n');
  const entries: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)/);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim();
      const anchor = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      entries.push(`${'  '.repeat(level - 1)}- [${text}](#${anchor})`);
    }
  }
  return entries.join('\n');
}

export function MarkdownToolbar({ editorRef, disabled }: Props) {
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showStatus(text: string, type: 'success' | 'error', duration = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ text, type });
    timerRef.current = setTimeout(() => setStatus(null), duration);
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function addHeading(level: number) {
    const prefix = '#'.repeat(level) + ' ';
    if (hasSel(editorRef)) {
      replaceSel(editorRef, addLinePrefix1(getSel(editorRef), prefix));
    } else {
      editorRef.current?.replaceSelection(prefix);
    }
  }

  function handlePreview() {
    const content = getText(editorRef);
    const html = marked.parse(content) as string;
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.7;color:#cdd6f4;background:#1e1e2e}pre{background:#181825;padding:12px;border-radius:6px;overflow-x:auto}code{background:#181825;padding:2px 5px;border-radius:3px;font-size:.9em}blockquote{border-left:4px solid #5a9cf7;margin:0;padding-left:16px;color:#a6adc8}img{max-width:100%}a{color:#5a9cf7}table{border-collapse:collapse;width:100%}th,td{border:1px solid #45475a;padding:8px 12px}th{background:#181825}</style>
</head><body>${html}</body></html>`;
    void invoke('open_html_preview', { html: fullHtml });
  }

  function handleTable() {
    editorRef.current?.replaceSelection(
      '| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Value    | Value    | Value    |\n'
    );
  }

  function handleToc() {
    const content = getText(editorRef);
    const toc = generateToc(content);
    if (!toc) { showStatus('No headings found', 'error', 3000); return; }
    editorRef.current?.replaceSelection(toc + '\n\n');
    showStatus('TOC inserted', 'success', 2000);
  }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      {status && <div className={`ctx-status-banner ctx-status-${status.type}`}>{status.text}</div>}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" style={{ fontWeight: 700 }} onClick={() => wrapSel(editorRef, '**', '**', 'bold text')} disabled={disabled} title="Bold">B</button>
        <button className="ctx-btn" style={{ fontStyle: 'italic' }} onClick={() => wrapSel(editorRef, '_', '_', 'italic')} disabled={disabled} title="Italic">I</button>
        <button className="ctx-btn" style={{ textDecoration: 'line-through' }} onClick={() => wrapSel(editorRef, '~~', '~~', 'strikethrough')} disabled={disabled} title="Strikethrough">S</button>
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '`', '`', 'code')} disabled={disabled} title="Inline code">Code</button>
        {sep}
        <button className="ctx-btn" onClick={() => addHeading(1)} disabled={disabled} title="Heading 1">H1</button>
        <button className="ctx-btn" onClick={() => addHeading(2)} disabled={disabled} title="Heading 2">H2</button>
        <button className="ctx-btn" onClick={() => addHeading(3)} disabled={disabled} title="Heading 3">H3</button>
        {sep}
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '[', '](url)', 'link text')} disabled={disabled} title="Insert link">Link</button>
        <button className="ctx-btn" onClick={() => editorRef.current?.replaceSelection('![alt text](url)')} disabled={disabled} title="Insert image">Image</button>
        {sep}
        <button className="ctx-btn" onClick={handlePreview} disabled={disabled} title="Open rendered preview">Preview</button>
      </div>
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => addLinePrefix(editorRef, '- ')} disabled={disabled} title="Bullet list">• List</button>
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) {
            replaceSel(editorRef, sel.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n'));
          } else { editorRef.current?.replaceSelection('1. '); }
        }} disabled={disabled} title="Numbered list">1. List</button>
        <button className="ctx-btn" onClick={() => addLinePrefix(editorRef, '- [ ] ')} disabled={disabled} title="Task list">☐ Task</button>
        {sep}
        <button className="ctx-btn" onClick={() => addLinePrefix(editorRef, '> ')} disabled={disabled} title="Blockquote">Quote</button>
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '```\n', '\n```', 'code')} disabled={disabled} title="Code block">``` Block</button>
        {sep}
        <button className="ctx-btn" onClick={handleTable} disabled={disabled} title="Insert table template">Table</button>
        <button className="ctx-btn" onClick={handleToc} disabled={disabled} title="Generate table of contents from headings">TOC</button>
      </div>
    </div>
  );
}
