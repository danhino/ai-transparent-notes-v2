import { useState, useRef, useEffect } from 'react';
import { format } from 'sql-formatter';
import type { SqlLanguage } from 'sql-formatter';
import type { NoteEditorRef } from './NoteEditor';
import { getText, apply, replaceSel, wrapSel, hasSel, getSel, addLinePrefix } from '../utils/toolbarUtils';
import { detectSqlDialect } from '../utils/sqlDetect';
import { useUiStore } from '../stores/uiStore';

interface StatusMsg { text: string; type: 'success' | 'error'; }
interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; paneIndex: number; showInvisibles: boolean; onToggleInvisibles: () => void; }

type Dialect = Extract<SqlLanguage, 'sql' | 'mysql' | 'postgresql' | 'sqlite' | 'tsql' | 'plsql'>;

const DIALECTS: { label: string; value: Dialect }[] = [
  { label: 'Auto', value: 'sql' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'T-SQL', value: 'tsql' },
  { label: 'PL/SQL', value: 'plsql' },
];

const KEYWORD_LIST = [
  'select','from','where','join','left','right','inner','outer','cross','on','group','by',
  'order','having','limit','offset','union','all','insert','into','values','update','set',
  'delete','create','table','drop','alter','with','case','when','then','else','end',
  'as','distinct','top','and','or','not','in','is','null','like','between','exists',
  'count','sum','avg','min','max','coalesce','cast','convert','isnull','nvl',
];

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

export function SqlToolbar({ editorRef, disabled, paneIndex, showInvisibles, onToggleInvisibles }: Props) {
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dialect, setDialect] = useState<Dialect>('sql');
  const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | 'empty'>('empty');
  const [validationError, setValidationError] = useState('');
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [content, setContent] = useState('');
  const contentRef = useRef('');
  const handleFormatRef = useRef<() => void>(() => {});
  const lastDetectedLengthRef = useRef(0);
  const setPaneDialect = useUiStore((s) => s.setPaneDialect);

  function showStatus(text: string, type: 'success' | 'error', duration = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ text, type });
    timerRef.current = setTimeout(() => setStatus(null), duration);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Poll editor content for passive validation
  useEffect(() => {
    const tick = () => {
      const current = getText(editorRef);
      if (current !== contentRef.current) {
        contentRef.current = current;
        setContent(current);
      }
    };
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [editorRef]);

  // Auto-detect SQL dialect on file open (large content change only)
  useEffect(() => {
    if (!content.trim()) return;
    const delta = Math.abs(content.length - lastDetectedLengthRef.current);
    if (delta < 50) return;
    lastDetectedLengthRef.current = content.length;
    const result = detectSqlDialect(content);
    if (result.confidence === 'high') {
      setDialect(result.dialect);
    }
  }, [content]);

  // Sync dialect to uiStore so StatusBar can read it per-pane
  useEffect(() => {
    setPaneDialect(paneIndex, dialect);
  }, [dialect, paneIndex, setPaneDialect]);

  // Passive inline validation
  useEffect(() => {
    if (!content.trim()) {
      setValidationStatus('empty');
      return;
    }
    const timer = setTimeout(() => {
      try {
        format(content, { language: dialect });
        setValidationStatus('valid');
        setValidationError('');
      } catch (err) {
        setValidationStatus('invalid');
        setValidationError(err instanceof Error ? err.message : String(err));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [content, dialect]);

  function handleFormatSql() {
    const current = getText(editorRef);
    try {
      const formatted = format(current, {
        language: dialect,
        tabWidth: 2,
        keywordCase: 'upper',
        linesBetweenQueries: 2,
        indentStyle: 'standard',
      });
      apply(editorRef, formatted);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setValidationError(msg);
      setValidationStatus('invalid');
    }
  }
  handleFormatRef.current = handleFormatSql;

  // Ctrl+Shift+F keyboard shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F' && !disabled) {
        e.preventDefault();
        handleFormatRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [disabled]);

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
    const current = getText(editorRef);
    const lines = current.split('\n').length;
    const stmts = (current.match(/;/g) || []).length;
    showStatus(`${stmts} statement${stmts !== 1 ? 's' : ''}, ${lines} lines`, 'success', 4000);
  }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      {status && <div className={`ctx-status-banner ctx-status-${status.type}`}>{status.text}</div>}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={handleFormatSql} disabled={disabled} title="Format SQL (Ctrl+Shift+F)">Format SQL</button>
        <select
          className="ctx-select"
          value={dialect}
          onChange={e => setDialect(e.target.value as Dialect)}
          disabled={disabled}
          title="SQL dialect"
        >
          {DIALECTS.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
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
        <button className="ctx-btn" onClick={() => setShowValidationPanel(v => !v)} disabled={disabled} title="Toggle validation panel">Validate</button>
        <div style={{ flex: 1 }} />
        {validationStatus === 'valid' && (
          <span className="sql-status sql-status--valid" title="Valid SQL">&#10003; Valid</span>
        )}
        {validationStatus === 'invalid' && (
          <span
            className="sql-status sql-status--invalid"
            title={validationError}
            onClick={() => setShowValidationPanel(v => !v)}
          >
            &#10007; Syntax error
          </span>
        )}
      </div>
      {showValidationPanel && (
        <div className="sql-validation-panel">
          {validationStatus === 'valid'
            ? <span className="sql-validation-ok">&#10003; No syntax errors detected</span>
            : <span className="sql-validation-err">{validationError || 'Enter SQL to validate'}</span>
          }
          <button onClick={() => setShowValidationPanel(false)}>&#10005;</button>
        </div>
      )}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => insertTemplate('SELECT *\nFROM table_name\nWHERE condition;')} disabled={disabled} title="SELECT * template">SELECT *</button>
        <button className="ctx-btn" onClick={() => insertTemplate('INSERT INTO table_name (col1, col2)\nVALUES (val1, val2);')} disabled={disabled} title="INSERT INTO template">INSERT</button>
        <button className="ctx-btn" onClick={() => insertTemplate('UPDATE table_name\nSET col1 = val1\nWHERE condition;')} disabled={disabled} title="UPDATE template">UPDATE</button>
        <button className="ctx-btn" onClick={() => insertTemplate('DELETE FROM table_name\nWHERE condition;')} disabled={disabled} title="DELETE template">DELETE</button>
        {sep}
        <button className="ctx-btn" onClick={() => insertTemplate('CREATE TABLE table_name (\n  id INT PRIMARY KEY,\n  name VARCHAR(255) NOT NULL\n);')} disabled={disabled} title="CREATE TABLE template">CREATE</button>
        <button className="ctx-btn" onClick={() => insertTemplate('SELECT\n  t1.col,\n  t2.col\nFROM table1 t1\nINNER JOIN table2 t2 ON t1.id = t2.id\nWHERE condition\nGROUP BY t1.col\nORDER BY t1.col ASC;')} disabled={disabled} title="Full query template">Full query</button>
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
}
