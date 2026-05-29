import { useState, useRef, useEffect } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { getText, apply, replaceSel, wrapSel, hasSel, getSel, addLinePrefix } from '../utils/toolbarUtils';

interface StatusMsg { text: string; type: 'success' | 'error'; }
interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; }

const KEYWORD_LIST = [
  'select','from','where','join','left','right','inner','outer','cross','on','group','by',
  'order','having','limit','offset','union','all','insert','into','values','update','set',
  'delete','create','table','drop','alter','with','case','when','then','else','end',
  'as','distinct','top','and','or','not','in','is','null','like','between','exists',
  'count','sum','avg','min','max','coalesce','cast','convert','isnull','nvl',
];

function formatSql(sql: string): string {
  const BREAK_BEFORE = /\b(SELECT|FROM|WHERE|LEFT JOIN|RIGHT JOIN|INNER JOIN|OUTER JOIN|CROSS JOIN|JOIN|ON|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|UNION ALL|UNION|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|CREATE TABLE|DROP TABLE|ALTER TABLE|WITH)\b/gi;
  let result = sql.replace(/\s+/g, ' ').trim();
  result = result.replace(BREAK_BEFORE, '\n$1');
  return result.trim();
}

function upperKeywords(sql: string): string {
  let result = sql;
  for (const kw of KEYWORD_LIST) {
    result = result.replace(new RegExp(`\\b${kw}\\b`, 'gi'), kw.toUpperCase());
  }
  return result;
}

function lowerKeywords(sql: string): string {
  let result = sql;
  for (const kw of KEYWORD_LIST) {
    result = result.replace(new RegExp(`\\b${kw.toUpperCase()}\\b`, 'g'), kw.toLowerCase());
  }
  return result;
}

export function SqlToolbar({ editorRef, disabled }: Props) {
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showStatus(text: string, type: 'success' | 'error', duration = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ text, type });
    timerRef.current = setTimeout(() => setStatus(null), duration);
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function handleFormat() {
    apply(editorRef, formatSql(getText(editorRef)));
    showStatus('Formatted', 'success', 2000);
  }
  function handleMinify() {
    apply(editorRef, getText(editorRef).replace(/\s+/g, ' ').trim());
    showStatus('Minified', 'success', 2000);
  }
  function handleUpperKw() { apply(editorRef, upperKeywords(getText(editorRef))); showStatus('Keywords uppercased', 'success', 2000); }
  function handleLowerKw() { apply(editorRef, lowerKeywords(getText(editorRef))); showStatus('Keywords lowercased', 'success', 2000); }
  function handleBlockComment() { wrapSel(editorRef, '/* ', ' */', 'comment'); }
  function handleLineComment() { addLinePrefix(editorRef, '-- '); }
  function handleUncomment() {
    if (hasSel(editorRef)) {
      replaceSel(editorRef, getSel(editorRef)
        .replace(/\/\*\s?([\s\S]*?)\s?\*\//g, '$1')
        .split('\n').map(l => l.replace(/^--\s?/, '')).join('\n'));
    } else {
      apply(editorRef, getText(editorRef)
        .replace(/\/\*\s?([\s\S]*?)\s?\*\//g, '$1')
        .split('\n').map(l => l.replace(/^--\s?/, '')).join('\n'));
    }
  }

  function insertTemplate(t: string) { editorRef.current?.replaceSelection(t); }

  function handleCountLines() {
    const content = getText(editorRef);
    const lines = content.split('\n').length;
    const stmts = (content.match(/;/g) || []).length;
    showStatus(`${stmts} statement${stmts !== 1 ? 's' : ''}, ${lines} lines`, 'success', 4000);
  }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      {status && <div className={`ctx-status-banner ctx-status-${status.type}`}>{status.text}</div>}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={handleFormat} disabled={disabled} title="Format SQL with keyword newlines">Pretty print</button>
        <button className="ctx-btn" onClick={handleMinify} disabled={disabled} title="Collapse to single line">Minify</button>
        {sep}
        <button className="ctx-btn" onClick={handleUpperKw} disabled={disabled} title="Uppercase all SQL keywords">UPPER kw</button>
        <button className="ctx-btn" onClick={handleLowerKw} disabled={disabled} title="Lowercase all SQL keywords">lower kw</button>
        {sep}
        <button className="ctx-btn" onClick={handleBlockComment} disabled={disabled} title="Wrap selection in /* */">/* Comment */</button>
        <button className="ctx-btn" onClick={handleLineComment} disabled={disabled} title="Add -- to each selected line">-- Line</button>
        <button className="ctx-btn" onClick={handleUncomment} disabled={disabled} title="Remove comment markers">Uncomment</button>
        {sep}
        <button className="ctx-btn" onClick={handleCountLines} disabled={disabled} title="Count statements and lines">Count</button>
      </div>
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => insertTemplate('SELECT *\nFROM table_name\nWHERE condition;')} disabled={disabled} title="INSERT SELECT * template">SELECT *</button>
        <button className="ctx-btn" onClick={() => insertTemplate('INSERT INTO table_name (col1, col2)\nVALUES (val1, val2);')} disabled={disabled} title="INSERT INTO template">INSERT</button>
        <button className="ctx-btn" onClick={() => insertTemplate('UPDATE table_name\nSET col1 = val1\nWHERE condition;')} disabled={disabled} title="UPDATE template">UPDATE</button>
        <button className="ctx-btn" onClick={() => insertTemplate('DELETE FROM table_name\nWHERE condition;')} disabled={disabled} title="DELETE template">DELETE</button>
        {sep}
        <button className="ctx-btn" onClick={() => insertTemplate('CREATE TABLE table_name (\n  id INT PRIMARY KEY,\n  name VARCHAR(255) NOT NULL\n);')} disabled={disabled} title="CREATE TABLE template">CREATE</button>
        <button className="ctx-btn" onClick={() => insertTemplate('SELECT\n  t1.col,\n  t2.col\nFROM table1 t1\nINNER JOIN table2 t2 ON t1.id = t2.id\nWHERE condition\nGROUP BY t1.col\nORDER BY t1.col ASC;')} disabled={disabled} title="Full query template">Full query</button>
      </div>
    </div>
  );
}
