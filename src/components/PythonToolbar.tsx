import { useRef, useEffect, memo } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { addLinePrefix, removeLinePrefix, wrapSel, getSel, hasSel, replaceSel } from '../utils/toolbarUtils';

interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; showInvisibles: boolean; onToggleInvisibles: () => void; }

export const PythonToolbar = memo(function PythonToolbar({ editorRef, disabled, showInvisibles, onToggleInvisibles }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function ins(t: string) { editorRef.current?.replaceSelection(t); }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => addLinePrefix(editorRef, '# ')} disabled={disabled} title="Comment selected lines"># Comment</button>
        <button className="ctx-btn" onClick={() => removeLinePrefix(editorRef, '# ')} disabled={disabled} title="Uncomment selected lines">Uncomment</button>
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '"""\n', '\n"""', 'docstring')} disabled={disabled} title='Wrap in triple-quote docstring'>&quot;&quot;&quot; Docstring</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('def function_name(arg):\n    """Docstring."""\n    pass\n')} disabled={disabled} title="Insert function template">def</button>
        <button className="ctx-btn" onClick={() => ins('class ClassName:\n    def __init__(self):\n        pass\n')} disabled={disabled} title="Insert class template">class</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('if condition:\n    pass\nelif other:\n    pass\nelse:\n    pass\n')} disabled={disabled} title="if/elif/else template">if/elif/else</button>
        <button className="ctx-btn" onClick={() => ins('for item in iterable:\n    pass\n')} disabled={disabled} title="for loop template">for</button>
        <button className="ctx-btn" onClick={() => ins('while condition:\n    pass\n')} disabled={disabled} title="while loop template">while</button>
      </div>
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => ins('import module_name\n')} disabled={disabled} title="import statement">import</button>
        <button className="ctx-btn" onClick={() => ins('from module import name\n')} disabled={disabled} title="from/import statement">from</button>
        {sep}
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          replaceSel(editorRef, `[x for x in ${sel || 'iterable'}]`);
        }} disabled={disabled} title="List comprehension">List comp</button>
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          replaceSel(editorRef, `{k: v for k, v in ${sel || 'iterable'}}`);
        }} disabled={disabled} title="Dict comprehension">Dict comp</button>
        {sep}
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) replaceSel(editorRef, `try:\n    ${sel.split('\n').join('\n    ')}\nexcept Exception as e:\n    pass\n`);
          else ins('try:\n    pass\nexcept Exception as e:\n    pass\n');
        }} disabled={disabled} title="try/except wrapper">try/except</button>
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          if (hasSel(editorRef)) replaceSel(editorRef, `with context_manager as cm:\n    ${sel.split('\n').join('\n    ')}\n`);
          else ins('with context_manager as cm:\n    pass\n');
        }} disabled={disabled} title="with block wrapper">with</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('lambda x: x\n')} disabled={disabled} title="Lambda expression">lambda</button>
        <button className="ctx-btn" onClick={() => ins('print(f"")\n')} disabled={disabled} title="print statement">print</button>
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
});
