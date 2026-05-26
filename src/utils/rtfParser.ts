// ─── Strip RTF for AI input ───────────────────────────────────────────────────

export function stripRtfTags(rtf: string): string {
  return rtf
    .replace(/\{\\rtf[^}]*\}/g, '')
    .replace(/\{\\[^{}]*\}/g, '')
    .replace(/\\[a-zA-Z]+[-\d]* ?/g, '')
    .replace(/\\./g, '')
    .replace(/[{}]/g, '')
    .replace(/\r\n|\r/g, '\n')
    .trim();
}

// ─── RTF → HTML (for loading into contenteditable) ───────────────────────────

export function rtfToHtml(rtf: string): string {
  const trimmed = rtf.trim();

  // If it already looks like HTML (saved after editing), pass through
  if (trimmed.startsWith('<')) return rtf;

  // Not RTF at all — plain-text note with RTF format label
  if (!trimmed.startsWith('{\\rtf')) {
    return escapeHtmlChars(rtf).replace(/\n/g, '<br>');
  }

  let t = rtf;

  // Strip common header sections that contain no user text
  t = t.replace(/\{\\fonttbl(?:[^{}]|\{[^{}]*\})*\}/g, '');
  t = t.replace(/\{\\colortbl(?:[^{}]|\{[^{}]*\})*\}/g, '');
  t = t.replace(/\{\\stylesheet(?:[^{}]|\{[^{}]*\})*\}/g, '');
  t = t.replace(/\{\\info(?:[^{}]|\{[^{}]*\})*\}/g, '');
  t = t.replace(/\{\\\*[^}]*\}/g, ''); // destination groups like {\* ...}

  // Inline formatting groups written by htmlToRtf / old toolbar
  for (let pass = 0; pass < 4; pass++) {
    t = t.replace(/\{\\b ([^{}]+)\}/g,      '<strong>$1</strong>');
    t = t.replace(/\{\\i ([^{}]+)\}/g,       '<em>$1</em>');
    t = t.replace(/\{\\ul ([^{}]+)\}/g,      '<u>$1</u>');
    t = t.replace(/\{\\strike ([^{}]+)\}/g,  '<s>$1</s>');
    // heading / style paragraph groups
    t = t.replace(/\{\\pard[^{]*\{([^{}]+)\}\\par\}/g, '$1<br>');
  }

  // Paragraph and line breaks
  t = t.replace(/\\par\b\s*/g,  '<br>');
  t = t.replace(/\\line\b\s*/g, '<br>');
  t = t.replace(/\\tab\b/g,     '    ');

  // Unicode escape sequences \uN?
  t = t.replace(/\\u(\d+)\??/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));

  // Drop the outer RTF wrapper
  t = t.replace(/^\s*\{\\rtf\d+[^{}]*/, '');

  // Strip remaining control words, groups, and lone braces
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

// ─── HTML → RTF (for saving contenteditable output back to disk) ──────────────

export function htmlToRtf(html: string): string {
  if (!html.trim()) {
    return '{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0\\fnil\\fcharset0 Segoe UI;}}\n\\f0\\fs24\n}';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function escapeRtf(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}');
  }

  function nodeToRtf(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeRtf(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(nodeToRtf).join('');

    switch (tag) {
      case 'strong': case 'b':   return `{\\b ${children}}`;
      case 'em':     case 'i':   return `{\\i ${children}}`;
      case 'u':                  return `{\\ul ${children}}`;
      case 's': case 'del':      return `{\\strike ${children}}`;
      case 'br':                 return '\\par\n';
      case 'p':                  return children + (children.endsWith('\\par\n') ? '' : '\\par\n');
      case 'div':                return children + '\\par\n';
      case 'h1':                 return `{\\b\\fs40 ${children}}\\par\n`;
      case 'h2':                 return `{\\b\\fs32 ${children}}\\par\n`;
      case 'h3':                 return `{\\b\\fs28 ${children}}\\par\n`;
      case 'li':                 return `\\bullet ${children}\\par\n`;
      case 'ul': case 'ol':      return children;
      case 'table': {
        // Flatten table cells with tab separation
        return children + '\\par\n';
      }
      case 'tr':                 return children + '\\par\n';
      case 'td': case 'th':      return children + '\\tab ';
      case 'hr':                 return '\\par ________________________________\\par\n';
      case 'span': {
        const style = (el.getAttribute('style') ?? '').toLowerCase();
        let result = children;
        if (/font-weight:\s*bold/.test(style))              result = `{\\b ${result}}`;
        if (/font-style:\s*italic/.test(style))             result = `{\\i ${result}}`;
        if (/text-decoration:[^;]*underline/.test(style))   result = `{\\ul ${result}}`;
        if (/text-decoration:[^;]*line-through/.test(style)) result = `{\\strike ${result}}`;
        return result;
      }
      case 'body': return children;
      default:     return children;
    }
  }

  const rtfBody = nodeToRtf(doc.body).trim();

  return [
    '{\\rtf1\\ansi\\deff0',
    '{\\fonttbl{\\f0\\fnil\\fcharset0 Segoe UI;}}',
    '\\f0\\fs24',
    rtfBody,
    '}',
  ].join('\n');
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function escapeHtmlChars(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Strip HTML tags to plain text (used by AI pipeline for RTF notes)
export function stripHtmlTags(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.innerText ?? doc.body.textContent ?? '';
}
