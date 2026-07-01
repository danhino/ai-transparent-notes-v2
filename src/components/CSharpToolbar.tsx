import { useRef, useEffect, memo } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { addLinePrefix, removeLinePrefix, wrapSel, hasSel, getSel, replaceSel } from '../utils/toolbarUtils';

interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; showInvisibles: boolean; onToggleInvisibles: () => void; }

export const CSharpToolbar = memo(function CSharpToolbar({ editorRef, disabled, showInvisibles, onToggleInvisibles }: Props) {
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
        {sep}
        <button className="ctx-btn" onClick={() => ins('namespace MyNamespace\n{\n    \n}\n')} disabled={disabled} title="Namespace template">namespace</button>
        <button className="ctx-btn" onClick={() => ins('public class ClassName\n{\n    public ClassName()\n    {\n    }\n}\n')} disabled={disabled} title="Class template">class</button>
        <button className="ctx-btn" onClick={() => ins('public interface IName\n{\n    void Method();\n}\n')} disabled={disabled} title="Interface template">interface</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('public Type PropertyName { get; set; }\n')} disabled={disabled} title="Auto property">prop</button>
        <button className="ctx-btn" onClick={() => ins('public ClassName()\n{\n}\n')} disabled={disabled} title="Constructor">ctor</button>
      </div>
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) replaceSel(editorRef, `try\n{\n    ${sel.split('\n').join('\n    ')}\n}\ncatch (Exception ex)\n{\n    \n}\nfinally\n{\n}\n`);
          else ins('try\n{\n    \n}\ncatch (Exception ex)\n{\n    \n}\n');
        }} disabled={disabled} title="try/catch/finally">try/catch</button>
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) replaceSel(editorRef, `using (var resource = new Resource())\n{\n    ${sel.split('\n').join('\n    ')}\n}\n`);
          else ins('using (var resource = new Resource())\n{\n    \n}\n');
        }} disabled={disabled} title="using block">using</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('public async Task<Type> MethodAsync()\n{\n    await Task.Delay(0);\n    return default;\n}\n')} disabled={disabled} title="Async Task method">async Task</button>
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          replaceSel(editorRef, `await ${sel || 'task'}`);
        }} disabled={disabled} title="Add await">await</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('.Where(x => x.Property == value)\n.Select(x => x.Property)\n.ToList()')} disabled={disabled} title="LINQ chain">LINQ</button>
        {sep}
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) replaceSel(editorRef, `#region ${sel}\n\n#endregion\n`);
          else ins('#region Region\n\n#endregion\n');
        }} disabled={disabled} title="Wrap in #region">#region</button>
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
});
