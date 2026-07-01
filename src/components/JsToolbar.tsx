import { useRef, useEffect, memo } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { replaceSel, wrapSel, hasSel, getSel, addLinePrefix, removeLinePrefix } from '../utils/toolbarUtils';

interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; format?: string; showInvisibles: boolean; onToggleInvisibles: () => void; }

export const JsToolbar = memo(function JsToolbar({ editorRef, disabled, format, showInvisibles, onToggleInvisibles }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const isTs = format === 'TypeScript';
  function ins(t: string) { editorRef.current?.replaceSelection(t); }

  function handleArrowFn() {
    const sel = getSel(editorRef);
    const converted = sel.replace(/function\s+(\w+)\s*\((.*?)\)\s*\{/g, 'const $1 = ($2) => {');
    if (hasSel(editorRef)) replaceSel(editorRef, converted);
    else ins('const fn = () => {\n  \n};\n');
  }

  function handleConsoleLog() {
    const sel = getSel(editorRef);
    ins(`console.log(${sel || "''"});\n`);
  }

  function handleTryCatch() {
    const sel = getSel(editorRef);
    if (hasSel(editorRef)) {
      replaceSel(editorRef, `try {\n  ${sel.split('\n').join('\n  ')}\n} catch (error) {\n  console.error(error);\n}\n`);
    } else {
      ins('try {\n  \n} catch (error) {\n  console.error(error);\n}\n');
    }
  }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => addLinePrefix(editorRef, '// ')} disabled={disabled} title="Comment selected lines">// Comment</button>
        <button className="ctx-btn" onClick={() => removeLinePrefix(editorRef, '// ')} disabled={disabled} title="Remove // comments">Uncomment</button>
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '/* ', ' */', 'comment')} disabled={disabled} title="Block comment">/* Block */</button>
        {sep}
        <button className="ctx-btn" onClick={handleArrowFn} disabled={disabled} title="Convert to arrow function or insert template">Arrow fn</button>
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) replaceSel(editorRef, `async function asyncFn() {\n  ${sel.split('\n').join('\n  ')}\n}\n`);
          else ins('async function asyncFn() {\n  const result = await somePromise();\n  return result;\n}\n');
        }} disabled={disabled} title="Async/await wrapper">async/await</button>
        {sep}
        <button className="ctx-btn" onClick={handleConsoleLog} disabled={disabled} title="Insert console.log">console.log</button>
        <button className="ctx-btn" onClick={() => ins('debugger;\n')} disabled={disabled} title="Insert debugger statement">debugger</button>
        <button className="ctx-btn" onClick={handleTryCatch} disabled={disabled} title="try/catch wrapper">try/catch</button>
      </div>
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => ins("import {  } from '';\n")} disabled={disabled} title="Import template">import</button>
        <button className="ctx-btn" onClick={() => ins("export default function Name() {\n  \n}\n")} disabled={disabled} title="Export template">export</button>
        {sep}
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          replaceSel(editorRef, `JSON.parse(${sel || "''"})`);
        }} disabled={disabled} title="Wrap in JSON.parse()">JSON.parse</button>
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          replaceSel(editorRef, `JSON.stringify(${sel || 'obj'}, null, 2)`);
        }} disabled={disabled} title="Wrap in JSON.stringify()">JSON.stringify</button>
        {sep}
        {isTs && <>
          <button className="ctx-btn" onClick={() => ins('interface Name {\n  prop: string;\n}\n')} disabled={disabled} title="TypeScript interface">TS: Interface</button>
          <button className="ctx-btn" onClick={() => ins('type Name = {\n  prop: string;\n};\n')} disabled={disabled} title="TypeScript type alias">TS: Type</button>
          <button className="ctx-btn" onClick={() => ins('enum Name {\n  Value1,\n  Value2,\n}\n')} disabled={disabled} title="TypeScript enum">TS: Enum</button>
        </>}
        {!isTs && <>
          <button className="ctx-btn" onClick={() => ins("/**\n * @param {type} name - description\n * @returns {type}\n */\n")} disabled={disabled} title="JSDoc comment">JSDoc</button>
          <button className="ctx-btn" onClick={() => ins('const obj = {\n  key: value,\n};\n')} disabled={disabled} title="Object literal">Object</button>
        </>}
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
});
