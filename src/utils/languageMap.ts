import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { sql } from '@codemirror/lang-sql';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { csharp } from '@codemirror/legacy-modes/mode/clike';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import type { Extension } from '@codemirror/state';

export function getLanguageExtension(format: string): Extension | null {
  switch (format.toLowerCase().trim()) {
    case 'python':                 return python();
    case 'javascript':             return javascript();
    case 'typescript':             return javascript({ typescript: true });
    case 'java':                   return java();
    case 'c':
    case 'c++':                    return cpp();
    case 'c#':                     return StreamLanguage.define(csharp);
    case 'rust':                   return rust();
    case 'sql':                    return sql();
    case 'html':
    case 'html/css':               return html();
    case 'css':                    return css();
    case 'markdown':               return markdown();
    case 'json':                   return json();
    case 'bash':
    case 'shell':                  return StreamLanguage.define(shell);
    case 'powershell':             return StreamLanguage.define(powerShell);
    case 'plain text':
    case 'auto-detect (code)':
    case 'html viewer':
    default:                       return null;
  }
}
