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

/* plainTextToRtf and its helpers are archived below — no longer the primary
   RTF path. The WYSIWYG editor stores content as HTML; htmlToRtf() converts
   to RTF for disk I/O. Kept for reference only.

export function plainTextToRtf(text: string): string {
  const body = convertMarkdownLinesToRtf(text);
  return [
    '{\\rtf1\\ansi\\deff0',
    '{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}{\\f1\\fnil\\fcharset0 Courier New;}}',
    '{\\colortbl;\\red0\\green0\\blue0;\\red90\\green156\\blue247;}',
    '\\f0\\fs24',
    body,
    '}',
  ].join('\n');
}
*/

// escapeRtfLiteral, convertInline, convertMarkdownLinesToRtf
// (helpers for the archived plainTextToRtf) are in git history.

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

  // ── Grouped patterns {control word content} — multi-pass for nesting ─────────
  for (let pass = 0; pass < 4; pass++) {
    // Bold + italic combos (before individual bold/italic to avoid partial match)
    t = t.replace(/\{\\b\\i\s([^{}]*)\}/g,   '<strong><em>$1</em></strong>');
    t = t.replace(/\{\\i\\b\s([^{}]*)\}/g,   '<strong><em>$1</em></strong>');
    // Individual inline formatting
    t = t.replace(/\{\\b\s([^{}]*)\}/g,      '<strong>$1</strong>');
    t = t.replace(/\{\\i\s([^{}]*)\}/g,      '<em>$1</em>');
    t = t.replace(/\{\\ul\s([^{}]*)\}/g,     '<u>$1</u>');
    t = t.replace(/\{\\strike\s([^{}]*)\}/g, '<s>$1</s>');
    // Monospace / code font
    t = t.replace(/\{\\f1\s([^{}]*)\}/g,     '<code>$1</code>');
    // Headings (largest first so the right rule fires)
    t = t.replace(/\{\\fs48\\b\s([^{}]*)\}/g, '<h1 style="font-size:2em">$1</h1>');
    t = t.replace(/\{\\fs40\\b\s([^{}]*)\}/g, '<h1>$1</h1>');
    t = t.replace(/\{\\fs36\\b\s([^{}]*)\}/g, '<h1>$1</h1>');
    t = t.replace(/\{\\fs36\\i\s([^{}]*)\}/g, '<h2 style="font-style:italic">$1</h2>');
    t = t.replace(/\{\\fs32\\b\s([^{}]*)\}/g, '<h2>$1</h2>');
    t = t.replace(/\{\\fs28\\b\s([^{}]*)\}/g, '<h3>$1</h3>');
    t = t.replace(/\{\\fs26\\b\s([^{}]*)\}/g, '<h4>$1</h4>');
    t = t.replace(/\{\\fs24\\b\s([^{}]*)\}/g, '<h3>$1</h3>');
    // Generic font-size group — strip the size, keep content
    t = t.replace(/\{\\fs\d+\s([^{}]*)\}/g,   '$1');
    // Quote / blockquote (braced, from toolbar)
    t = t.replace(/\{\\li720\\i\s([^{}]*)\}/g, '<blockquote><em>$1</em></blockquote>');
    // Braced bullet items (old format)
    t = t.replace(/\{\\pard[^{]*\\bullet\s([^{}]*)\}/g, '<li>$1</li>');
    // Font group — strip the font switch, keep content
    t = t.replace(/\{\\f\d+\s([^{}]*)\}/g, '$1');
  }

  // ── Brace-free paragraph patterns (before \par → <br> conversion) ─────────
  // Horizontal rule: \brdrb\brdrs\brdrwN\par
  t = t.replace(/\\brdrb\\brdrs(?:\\brdrw\d+)?\\par\b/g, '<hr>');
  // Blockquote: \pard\liN\i text\par\pard (brace-free, from plainTextToRtf)
  t = t.replace(/\\pard\\li\d+\\i\s+([^\\{}\n]+?)\\par\\pard/g,
    '<blockquote><em>$1</em></blockquote>');
  // Bullet: \pard(ctrl words)*\bullet(ctrl words)* text\par (brace-free, from plainTextToRtf)
  t = t.replace(/\\pard\S*?\\bullet\S*?\s([^{}\n]+?)\\par\b/g, '<li>$1</li>');

  // Paragraph and line breaks
  t = t.replace(/\\par\b\s*/g,  '<br>');
  t = t.replace(/\\line\b\s*/g, '<br>');
  t = t.replace(/\\tab\b/g,     '&nbsp;&nbsp;&nbsp;&nbsp;');

  // Unicode escape sequences
  t = t.replace(/\\u(\d+)\??/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));

  // Drop RTF wrapper and remaining control words.
  // Only remove the header line ({\rtf1\ansi\deff0), NOT the entire body.
  // [^{}]* was too greedy: after multi-pass converts {…} groups to HTML
  // (which has no braces), it would consume the whole document, leaving
  // only the closing } → empty preview. [^\n{]*\n? stops at the first
  // newline or { so only the single header line is removed.
  t = t.replace(/^\s*\{\\rtf\d+[^\n{]*\n?/, '');
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

// ─── HTML → RTF (for saving the WYSIWYG editor content to disk) ──────────────

export function htmlToRtf(html: string): string {
  if (!html.trim()) return DEFAULT_RTF;

  const body = html
    // Block-level elements — process headings before inline so nested spans work
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis,         '{\\fs40\\b $1}\\par\\par')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis,         '{\\fs32\\b $1}\\par\\par')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis,         '{\\fs28\\b $1}\\par\\par')
    // Inline formatting
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, '{\\b $1}')
    .replace(/<b[^>]*>(.*?)<\/b>/gis,           '{\\b $1}')
    .replace(/<em[^>]*>(.*?)<\/em>/gis,         '{\\i $1}')
    .replace(/<i[^>]*>(.*?)<\/i>/gis,           '{\\i $1}')
    .replace(/<u[^>]*>(.*?)<\/u>/gis,           '{\\ul $1}')
    .replace(/<s[^>]*>(.*?)<\/s>/gis,           '{\\strike $1}')
    .replace(/<del[^>]*>(.*?)<\/del>/gis,       '{\\strike $1}')
    .replace(/<code[^>]*>(.*?)<\/code>/gis,     '{\\f1 $1}')
    // Lists and quotes
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '\\pard\\li720 $1\\par\\pard')
    .replace(/<li[^>]*>(.*?)<\/li>/gis,         '\\pard\\fi-240\\li480\\bullet\\tx480 $1\\par')
    // Paragraphs and breaks
    .replace(/<br\s*\/?>/gi,                     '\\par ')
    .replace(/<p[^>]*>(.*?)<\/p>/gis,           '$1\\par ')
    .replace(/<div[^>]*>(.*?)<\/div>/gis,       '$1\\par ')
    // Strip any remaining tags
    .replace(/<[^>]+>/g,  '')
    // Decode HTML entities
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/&nbsp;/g,  ' ')
    .replace(/&quot;/g,  '"')
    .replace(/&#39;/g,   "'")
    // Encode non-ASCII as RTF Unicode escapes
    .replace(/[^\x00-\x7F]/g, (c) => `\\u${c.codePointAt(0)}? `);

  return [
    '{\\rtf1\\ansi\\deff0',
    '{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}{\\f1\\fnil\\fcharset0 Courier New;}}',
    '{\\colortbl;\\red0\\green0\\blue0;\\red90\\green156\\blue247;}',
    '\\f0\\fs24',
    body.trim(),
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
