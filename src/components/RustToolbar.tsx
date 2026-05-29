import { useRef, useEffect } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { addLinePrefix, removeLinePrefix, wrapSel, hasSel, getSel, replaceSel } from '../utils/toolbarUtils';

interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; }

export function RustToolbar({ editorRef, disabled }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function ins(t: string) { editorRef.current?.replaceSelection(t); }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => addLinePrefix(editorRef, '// ')} disabled={disabled} title="Comment lines">// Comment</button>
        <button className="ctx-btn" onClick={() => removeLinePrefix(editorRef, '// ')} disabled={disabled} title="Uncomment lines">Uncomment</button>
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '/* ', ' */', 'comment')} disabled={disabled} title="Block comment">/* Block */</button>
        <button className="ctx-btn" onClick={() => addLinePrefix(editorRef, '/// ')} disabled={disabled} title="Doc comment">/// Doc</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('fn function_name() {\n    \n}\n')} disabled={disabled} title="Function template">fn</button>
        <button className="ctx-btn" onClick={() => ins('struct Name {\n    field: Type,\n}\n')} disabled={disabled} title="Struct template">struct</button>
        <button className="ctx-btn" onClick={() => ins('impl Name {\n    fn new() -> Self {\n        Self {}\n    }\n}\n')} disabled={disabled} title="impl block">impl</button>
        <button className="ctx-btn" onClick={() => ins('enum Name {\n    Variant1,\n    Variant2,\n}\n')} disabled={disabled} title="Enum template">enum</button>
        {sep}
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          replaceSel(editorRef, `pub ${sel || 'fn function_name() {}'}`);
        }} disabled={disabled} title="Add pub keyword">pub</button>
      </div>
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) replaceSel(editorRef, `match ${sel} {\n    _ => {}\n}\n`);
          else ins('match value {\n    Some(x) => x,\n    None => default,\n}\n');
        }} disabled={disabled} title="match expression">match</button>
        <button className="ctx-btn" onClick={() => ins('if let Some(x) = option {\n    \n}\n')} disabled={disabled} title="if let">if let</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('let mut v: Vec<Type> = Vec::new();\n')} disabled={disabled} title="Vec::new()">Vec::new</button>
        <button className="ctx-btn" onClick={() => ins('use std::collections::HashMap;\nlet mut map = HashMap::new();\n')} disabled={disabled} title="HashMap::new()">HashMap</button>
        {sep}
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          ins(`println!("{}", ${sel || '""'});\n`);
        }} disabled={disabled} title="println! macro">println!</button>
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) replaceSel(editorRef, `${sel}.unwrap()`);
          else ins('.unwrap()');
        }} disabled={disabled} title="Append .unwrap()">.unwrap()</button>
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) replaceSel(editorRef, `${sel}?`);
          else ins('?');
        }} disabled={disabled} title="Append ? operator">?</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('#[derive(Debug, Clone)]\n')} disabled={disabled} title="#[derive(...)] attribute">#[derive]</button>
      </div>
    </div>
  );
}
