import { useRef, useEffect, memo } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { addLinePrefix, removeLinePrefix, wrapSel, hasSel, getSel, replaceSel } from '../utils/toolbarUtils';

interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; showInvisibles: boolean; onToggleInvisibles: () => void; }

export const JavaToolbar = memo(function JavaToolbar({ editorRef, disabled, showInvisibles, onToggleInvisibles }: Props) {
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
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          replaceSel(editorRef, `/**\n * ${sel || 'Description'}\n * @param paramName description\n * @return description\n */\n`);
        }} disabled={disabled} title="Javadoc comment">/** Javadoc */</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('public class ClassName {\n    public ClassName() {\n    }\n}\n')} disabled={disabled} title="Class template">class</button>
        <button className="ctx-btn" onClick={() => ins('public interface IName {\n    void method();\n}\n')} disabled={disabled} title="Interface template">interface</button>
        <button className="ctx-btn" onClick={() => ins('public enum Name {\n    VALUE1,\n    VALUE2\n}\n')} disabled={disabled} title="Enum template">enum</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('public static void main(String[] args) {\n    \n}\n')} disabled={disabled} title="main method">main</button>
      </div>
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) replaceSel(editorRef, `try {\n    ${sel.split('\n').join('\n    ')}\n} catch (Exception e) {\n    e.printStackTrace();\n} finally {\n}\n`);
          else ins('try {\n    \n} catch (Exception e) {\n    e.printStackTrace();\n}\n');
        }} disabled={disabled} title="try/catch/finally">try/catch</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('for (int i = 0; i < n; i++) {\n    \n}\n')} disabled={disabled} title="for loop">for</button>
        <button className="ctx-btn" onClick={() => ins('for (Type item : collection) {\n    \n}\n')} disabled={disabled} title="for-each loop">for-each</button>
        <button className="ctx-btn" onClick={() => ins('while (condition) {\n    \n}\n')} disabled={disabled} title="while loop">while</button>
        {sep}
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          ins(`System.out.println(${sel || '""'});\n`);
        }} disabled={disabled} title="System.out.println">System.out</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('@Override\n')} disabled={disabled} title="@Override annotation">@Override</button>
        <button className="ctx-btn" onClick={() => ins('public Type getName() {\n    return name;\n}\n\npublic void setName(Type name) {\n    this.name = name;\n}\n')} disabled={disabled} title="getter/setter pair">getter/setter</button>
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
});
