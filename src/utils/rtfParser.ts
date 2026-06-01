// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_RTF =
  '{\\rtf1\\ansi\\deff0\n' +
  '{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}{\\f1\\fnil\\fcharset0 Courier New;}}\n' +
  '{\\colortbl;\\red0\\green0\\blue0;\\red90\\green156\\blue247;}\n' +
  '\\f0\\fs24\n' +
  '}';

// ─── RTF text encoding ────────────────────────────────────────────────────────

/** Escape backslash, braces, and encode non-ASCII chars as RTF Unicode escapes. */
export function encodeRtfText(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.codePointAt(i)!;
    if (code > 0xffff) i++; // surrogate pair — skip second char
    if (ch === '\\') { out += '\\\\'; }
    else if (ch === '{')  { out += '\\{'; }
    else if (ch === '}')  { out += '\\}'; }
    else if (code > 127)  { out += `\\u${code}?`; }
    else { out += ch; }
  }
  return out;
}

/** Convert a plain-text string into a complete RTF document. */
export function plainTextToRtf(text: string): string {
  const body = encodeRtfText(text)
    .split('\n')
    .map((line) => line + '\\par')
    .join('\n');
  return [
    '{\\rtf1\\ansi\\deff0',
    '{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}{\\f1\\fnil\\fcharset0 Courier New;}}',
    '{\\colortbl;\\red0\\green0\\blue0;\\red90\\green156\\blue247;}',
    '\\f0\\fs24',
    body,
    '}',
  ].join('\n');
}

// ─── Strip RTF for AI input ───────────────────────────────────────────────────

export function stripRtfTags(rtf: string): string {
  if (!rtf.trim().startsWith('{\\rtf')) return rtf;
  return rtf
    .replace(/\{\\rtf[^}]*\}/g, '')
    .replace(/\{\\fonttbl(?:[^{}]|\{[^{}]*\})*\}/g, '')
    .replace(/\{\\colortbl(?:[^{}]|\{[^{}]*\})*\}/g, '')
    .replace(/\{\\stylesheet(?:[^{}]|\{[^{}]*\})*\}/g, '')
    .replace(/\{\\info(?:[^{}]|\{[^{}]*\})*\}/g, '')
    .replace(/\{\\\*[^}]*\}/g, '')
    .replace(/\\u(\d+)\??/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/\\par\b\s*/g, '\n')
    .replace(/\\line\b\s*/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\{\\[^{}]*\}/g, '')
    .replace(/\{[^{}]*\}/g, '')
    .replace(/\\[a-zA-Z]+[-\d]* ?/g, '')
    .replace(/\\./g, '')
    .replace(/[{}]/g, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── RTF → HTML (for the preview panel) ──────────────────────────────────────

export function rtfToHtml(rtf: string): string {
  const trimmed = rtf.trim();

  if (!trimmed.startsWith('{\\rtf')) {
    // Plain text being viewed in RTF mode — escape and convert newlines
    return escapeHtmlChars(rtf).replace(/\n/g, '<br>');
  }

  let t = rtf;

  // Strip header sections
  t = t.replace(/\{\\fonttbl(?:[^{}]|\{[^{}]*\})*\}/g, '');
  t = t.replace(/\{\\colortbl(?:[^{}]|\{[^{}]*\})*\}/g, '');
  t = t.replace(/\{\\stylesheet(?:[^{}]|\{[^{}]*\})*\}/g, '');
  t = t.replace(/\{\\info(?:[^{}]|\{[^{}]*\})*\}/g, '');
  t = t.replace(/\{\\\*[^}]*\}/g, '');

  // Inline formatting — run multiple passes for nested groups
  for (let pass = 0; pass < 4; pass++) {
    t = t.replace(/\{\\b\s([^{}]*)\}/g,       '<strong>$1</strong>');
    t = t.replace(/\{\\i\s([^{}]*)\}/g,        '<em>$1</em>');
    t = t.replace(/\{\\ul\s([^{}]*)\}/g,       '<u>$1</u>');
    t = t.replace(/\{\\strike\s([^{}]*)\}/g,   '<s>$1</s>');
    t = t.replace(/\{\\fs36\\b\s([^{}]*)\}/g,  '<h1>$1</h1>');
    t = t.replace(/\{\\fs28\\b\s([^{}]*)\}/g,  '<h2>$1</h2>');
    t = t.replace(/\{\\fs24\\b\s([^{}]*)\}/g,  '<h3>$1</h3>');
    t = t.replace(/\{\\pard[^{]*\\bullet\s([^{}]*)\}/g, '<li>$1</li>');
  }

  // Paragraph and line breaks
  t = t.replace(/\\par\b\s*/g,  '<br>');
  t = t.replace(/\\line\b\s*/g, '<br>');
  t = t.replace(/\\tab\b/g,     '&nbsp;&nbsp;&nbsp;&nbsp;');

  // Unicode escape sequences
  t = t.replace(/\\u(\d+)\??/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));

  // Drop RTF wrapper and remaining control words
  t = t.replace(/^\s*\{\\rtf\d+[^{}]*/, '');
  t = t.replace(/\{\\[^{}]*\}/g, '');
  t = t.replace(/\{[^{}]*\}/g, '');
  t = t.replace(/\\[a-zA-Z]+[-\d]* ?/g, '');
  t = t.replace(/\\./g, '');
  t = t.replace(/[{}]/g, '');

  // Normalise whitespace
  t = t.replace(/\r\n|\r/g, '\n');
  t = t.replace(/\n/g, '<br>');
  t = t.replace(/(<br>){3,}/g, '<br><br>');

  return t.trim();
}

// ─── HTML → RTF (for AI result conversion) ───────────────────────────────────

export function htmlToRtf(html: string): string {
  if (!html.trim()) return DEFAULT_RTF;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function escapeRtf(text: string): string {
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const code = text.codePointAt(i)!;
      if (code > 0xffff) i++;
      if (ch === '\\')      out += '\\\\';
      else if (ch === '{')  out += '\\{';
      else if (ch === '}')  out += '\\}';
      else if (code > 127)  out += `\\u${code}?`;
      else out += ch;
    }
    return out;
  }

  function nodeToRtf(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeRtf(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(nodeToRtf).join('');
    switch (tag) {
      case 'strong': case 'b':  return `{\\b ${children}}`;
      case 'em':     case 'i':  return `{\\i ${children}}`;
      case 'u':                 return `{\\ul ${children}}`;
      case 's': case 'del':     return `{\\strike ${children}}`;
      case 'br':                return '\\par\n';
      case 'p':                 return children + '\\par\n';
      case 'div':               return children + '\\par\n';
      case 'h1':                return `{\\fs36\\b ${children}}\\par\n`;
      case 'h2':                return `{\\fs28\\b ${children}}\\par\n`;
      case 'h3':                return `{\\fs24\\b ${children}}\\par\n`;
      case 'li':                return `\\bullet ${children}\\par\n`;
      case 'ul': case 'ol':     return children;
      case 'hr':                return '\\par ________________\\par\n';
      case 'body':              return children;
      default:                  return children;
    }
  }

  const body = nodeToRtf(doc.body).trim();
  return [
    '{\\rtf1\\ansi\\deff0',
    '{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}}',
    '\\f0\\fs24',
    body,
    '}',
  ].join('\n');
}

// ─── Strip HTML tags → plain text ─────────────────────────────────────────────

export function stripHtmlTags(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.innerText ?? doc.body.textContent ?? '';
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function escapeHtmlChars(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
