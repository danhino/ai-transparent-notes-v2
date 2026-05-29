import { useState, useRef, useEffect } from 'react';
import type { NoteEditorRef } from './NoteEditor';
import { addLinePrefix, removeLinePrefix, getText, apply } from '../utils/toolbarUtils';

interface StatusMsg { text: string; type: 'success' | 'error'; }
interface Props { editorRef: React.RefObject<NoteEditorRef | null>; disabled: boolean; format?: string; }

export function ShellToolbar({ editorRef, disabled, format }: Props) {
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showStatus(text: string, type: 'success' | 'error', duration = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ text, type }); timerRef.current = setTimeout(() => setStatus(null), duration);
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const isPs = format === 'PowerShell';
  function ins(t: string) { editorRef.current?.replaceSelection(t); }

  const sep = <div className="ctx-toolbar-sep" />;
  return (
    <div className="contextual-toolbar">
      {status && <div className={`ctx-status-banner ctx-status-${status.type}`}>{status.text}</div>}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => addLinePrefix(editorRef, '# ')} disabled={disabled} title="Comment selected lines"># Comment</button>
        <button className="ctx-btn" onClick={() => removeLinePrefix(editorRef, '# ')} disabled={disabled} title="Uncomment selected lines">Uncomment</button>
        {sep}
        {!isPs && <button className="ctx-btn" onClick={() => ins('if [ condition ]; then\n    \nfi\n')} disabled={disabled} title="if/then/fi template">if/then</button>}
        {isPs  && <button className="ctx-btn" onClick={() => ins('if ($condition) {\n    \n}\n')} disabled={disabled} title="if block template">if</button>}
        <button className="ctx-btn" onClick={() => isPs
          ? ins('foreach ($item in $collection) {\n    \n}\n')
          : ins('for item in "${items[@]}"; do\n    \ndone\n')
        } disabled={disabled} title="for loop template">for</button>
        <button className="ctx-btn" onClick={() => isPs
          ? ins('while ($condition) {\n    \n}\n')
          : ins('while [ condition ]; do\n    \ndone\n')
        } disabled={disabled} title="while loop template">while</button>
        {sep}
        <button className="ctx-btn" onClick={() => isPs
          ? ins('function FunctionName {\n    param(\n        $Param\n    )\n    \n}\n')
          : ins('function function_name() {\n    \n}\n')
        } disabled={disabled} title="Function template">function</button>
        {sep}
        <button className="ctx-btn" onClick={() => isPs
          ? ins('Write-Host ""\n')
          : ins('echo ""\n')
        } disabled={disabled} title={isPs ? 'Write-Host' : 'echo'}>{isPs ? 'Write-Host' : 'echo'}</button>
      </div>
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={() => ins(' | ')} disabled={disabled} title="Pipe operator">pipe |</button>
        <button className="ctx-btn" onClick={() => ins(' > ')} disabled={disabled} title="Redirect output">redirect &gt;</button>
        <button className="ctx-btn" onClick={() => ins(' >> ')} disabled={disabled} title="Append output">append &gt;&gt;</button>
        {sep}
        <button className="ctx-btn" onClick={() => isPs
          ? ins('$VariableName = "value"\n')
          : ins('VARNAME="value"\n')
        } disabled={disabled} title="Variable declaration">{isPs ? '$Var =' : '$VAR='}</button>
        <button className="ctx-btn" onClick={() => isPs
          ? ins('$env:VARNAME = "value"\n')
          : ins('export VARNAME="value"\n')
        } disabled={disabled} title={isPs ? 'Environment variable' : 'export'}>{isPs ? '$env:' : 'export'}</button>
        {sep}
        {!isPs && <button className="ctx-btn" onClick={() => ins('set -euo pipefail\n')} disabled={disabled} title="Strict mode">set -euo</button>}
        {isPs  && <button className="ctx-btn" onClick={() => {
          const full = getText(editorRef);
          if (!full.startsWith('param(')) apply(editorRef, 'param(\n    $Param\n)\n\n' + full);
          else showStatus('param() already present', 'success', 2000);
        }} disabled={disabled} title="PowerShell param block">param()</button>}
        {!isPs && <button className="ctx-btn" onClick={() => {
          const full = getText(editorRef);
          if (!full.startsWith('#!')) apply(editorRef, '#!/usr/bin/env bash\n\n' + full);
          else showStatus('Shebang already present', 'success', 2000);
        }} disabled={disabled} title="Add shebang line">shebang</button>}
      </div>
    </div>
  );
}
