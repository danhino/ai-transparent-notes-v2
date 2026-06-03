import { useRef, useEffect } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { addLinePrefix, removeLinePrefix, wrapSel, getSel } from '../utils/toolbarUtils';

interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; format?: string; showInvisibles: boolean; onToggleInvisibles: () => void; }

export function CppToolbar({ editorRef, disabled, format, showInvisibles, onToggleInvisibles }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const isCpp = format === 'C++';
  function ins(t: string) { editorRef.current?.replaceSelection(t); }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => addLinePrefix(editorRef, '// ')} disabled={disabled} title="Comment lines">// Comment</button>
        <button className="ctx-btn" onClick={() => removeLinePrefix(editorRef, '// ')} disabled={disabled} title="Uncomment lines">Uncomment</button>
        <button className="ctx-btn" onClick={() => wrapSel(editorRef, '/* ', ' */', 'comment')} disabled={disabled} title="Block comment">/* Block */</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('#include <stdio.h>\n')} disabled={disabled} title="#include template">#include</button>
        <button className="ctx-btn" onClick={() => ins('#define NAME value\n')} disabled={disabled} title="#define template">#define</button>
        <button className="ctx-btn" onClick={() => ins('#ifdef SYMBOL\n\n#endif\n')} disabled={disabled} title="#ifdef guard">#ifdef</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('typedef struct {\n    int field;\n} StructName;\n')} disabled={disabled} title="struct template">struct</button>
        {isCpp && <button className="ctx-btn" onClick={() => ins('class ClassName {\npublic:\n    ClassName();\n    ~ClassName();\n};\n')} disabled={disabled} title="C++ class template">class</button>}
      </div>
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => {
          const sel = getSel(editorRef);
          ins(isCpp ? `std::cout << ${sel || '""'} << std::endl;\n` : `printf("%s\\n", ${sel || '""'});\n`);
        }} disabled={disabled} title={isCpp ? 'cout' : 'printf'}>{isCpp ? 'cout' : 'printf'}</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('for (int i = 0; i < n; i++) {\n    \n}\n')} disabled={disabled} title="for loop">for</button>
        <button className="ctx-btn" onClick={() => ins('while (condition) {\n    \n}\n')} disabled={disabled} title="while loop">while</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins(isCpp ? 'Type* ptr = new Type();\n' : 'Type* ptr = (Type*)malloc(sizeof(Type));\n')} disabled={disabled} title={isCpp ? 'new' : 'malloc'}>{isCpp ? 'new' : 'malloc'}</button>
        <button className="ctx-btn" onClick={() => ins(isCpp ? 'delete ptr;\n' : 'free(ptr);\n')} disabled={disabled} title={isCpp ? 'delete' : 'free'}>{isCpp ? 'delete' : 'free'}</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins(isCpp ? 'nullptr' : 'NULL')} disabled={disabled} title={isCpp ? 'nullptr' : 'NULL'}>{isCpp ? 'nullptr' : 'NULL'}</button>
        {sep}
        <button className="ctx-btn" onClick={() => ins('int main(int argc, char* argv[]) {\n    return 0;\n}\n')} disabled={disabled} title="main function">main</button>
        {sep}
        <button className={`ctx-btn${showInvisibles ? ' ctx-btn-active' : ''}`} onClick={onToggleInvisibles} disabled={disabled} title="Show all characters (spaces ·, tabs →, line endings ¶)">¶</button>
      </div>
    </div>
  );
}
