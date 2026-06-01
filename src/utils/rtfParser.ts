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

/** Convert a plain-text / Markdown string into a complete RTF document. */
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

/** Escape RTF special chars and encode non-ASCII as \\uN? */
function escapeRtfLiteral(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.codePointAt(i)!;
    if (code > 0xffff) i++;
    if (ch === '\\')     out += '\\\\';
    else if (ch === '{') out += '\\{';
    else if (ch === '}') out += '\\}';
    else if (code > 127) out += `\\u${code}?`;
    else                 out += ch;
  }
  return out;
}

/** Convert inline Markdown spans within a line to RTF control words. */
function convertInline(line: string): string {
  // Bold + italic (process first to avoid partial matches)
  line = line.replace(/\*{3}(.+?)\*{3}/g, (_, t) => `{\\b\\i ${escapeRtfLiteral(t)}}`);
  // Inline code
  line = line.replace(/`([^`]+)`/g, (_, t) => `{\\f1 ${escapeRtfLiteral(t)}}`);
  // Bold (**text** or __text__)
  line = line.replace(/\*{2}(.+?)\*{2}/g, (_, t) => `{\\b ${escapeRtfLiteral(t)}}`);
  line = line.replace(/_{2}(.+?)_{2}/g,   (_, t) => `{\\b ${escapeRtfLiteral(t)}}`);
  // Italic (*text* or _text_ — single, not double)
  line = line.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, (_, t) => `{\\i ${escapeRtfLiteral(t)}}`);
  line = line.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g,      (_, t) => `{\\i ${escapeRtfLiteral(t)}}`);
  return line;
}

/** Convert a full plain-text/Markdown body to RTF paragraph runs. */
function convertMarkdownLinesToRtf(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inBulletBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const next = i + 1 < lines.length ? lines[i + 1] : '';

    // ── Setext-style headings (underline on next line, consume both) ──────────
    if (raw.trim() !== '' && /^={3,}\s*$/.test(next)) {
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      const t = convertInline(escapeRtfLiteral(raw));
      out.push(`{\\fs40\\b ${t}}\\par`);
      i++; // skip the underline
      continue;
    }
    if (raw.trim() !== '' && /^-{3,}\s*$/.test(next) && !/^[-*] /.test(raw)) {
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      const t = convertInline(escapeRtfLiteral(raw));
      out.push(`{\\fs32\\b ${t}}\\par`);
      i++; // skip the underline
      continue;
    }

    // ── ALL CAPS short lines as section headings ──────────────────────────────
    const trimmed = raw.trim();
    if (
      trimmed.length >= 3 &&
      trimmed.length <= 60 &&
      /[A-Z]/.test(trimmed) &&                         // at least one uppercase
      /^[A-Z0-9\s,.:;!?()\-/]+$/.test(trimmed) &&     // only uppercase chars / punct
      !/^[-=]{3,}$/.test(trimmed) &&                   // not a separator line
      !trimmed.startsWith('|') &&                      // not a table row
      !/^#{1,6} /.test(raw) &&                         // not a Markdown heading
      !/^\d+\./.test(raw)                              // not a numbered heading (handled next)
    ) {
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      out.push(`\\par{\\fs26\\b ${escapeRtfLiteral(trimmed)}}\\par`);
      continue;
    }

    // ── Numbered section headings ─────────────────────────────────────────────
    if (/^\d+\.\d+\s/.test(raw)) {
      // 1.1 style → smaller heading
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      const t = convertInline(escapeRtfLiteral(raw));
      out.push(`{\\fs24\\b ${t}}\\par`);
      continue;
    }
    if (/^\d+\.\s+[A-Z]/.test(raw)) {
      // 1. Introduction style (starts with capital letter) → section heading
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      const t = convertInline(escapeRtfLiteral(raw));
      out.push(`{\\fs28\\b ${t}}\\par`);
      continue;
    }

    // Heading 1
    if (/^# /.test(raw)) {
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      const t = convertInline(escapeRtfLiteral(raw.replace(/^# /, '')));
      out.push(`{\\fs40\\b ${t}}\\par`);
      continue;
    }
    // Heading 2
    if (/^## /.test(raw)) {
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      const t = convertInline(escapeRtfLiteral(raw.replace(/^## /, '')));
      out.push(`{\\fs32\\b ${t}}\\par`);
      continue;
    }
    // Heading 3
    if (/^### /.test(raw)) {
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      const t = convertInline(escapeRtfLiteral(raw.replace(/^### /, '')));
      out.push(`{\\fs28\\b ${t}}\\par`);
      continue;
    }

    // Horizontal rules
    if (/^(-{3,}|={3,})\s*$/.test(raw)) {
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      out.push('\\brdrb\\brdrs\\brdrw10\\par');
      continue;
    }

    // Table separator rows — skip
    if (/^\|[\s\-|:]+\|$/.test(raw)) continue;

    // Table rows
    if (/^\|.*\|$/.test(raw)) {
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      const cells = raw.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const rtfCells = cells.map((c) => convertInline(escapeRtfLiteral(c))).join('\\tab ');
      out.push(`${rtfCells}\\par`);
      continue;
    }

    // Bullet list items (- or *)
    if (/^[-*] /.test(raw)) {
      inBulletBlock = true;
      const t = convertInline(escapeRtfLiteral(raw.replace(/^[-*] /, '')));
      out.push(`\\pard\\fi-240\\li480\\bullet\\tx480 ${t}\\par`);
      continue;
    }

    // Blockquotes
    if (/^> /.test(raw)) {
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      const t = convertInline(escapeRtfLiteral(raw.replace(/^> /, '')));
      out.push(`\\pard\\li720\\i ${t}\\par\\pard`);
      continue;
    }

    // Empty line
    if (raw.trim() === '') {
      if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
      out.push('\\par');
      continue;
    }

    // Plain line
    if (inBulletBlock) { out.push('\\pard'); inBulletBlock = false; }
    out.push(`${convertInline(escapeRtfLiteral(raw))}\\par`);
  }

  if (inBulletBlock) out.push('\\pard');
  return out.join('\n');
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
