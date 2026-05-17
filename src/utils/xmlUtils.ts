function prettyPrint(xml: string, indent = '  '): string {
  let result = '';
  let depth = 0;
  const normalized = xml.replace(/>\s*</g, '>\n<');
  const lines = normalized.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('</')) depth = Math.max(0, depth - 1);
    result += indent.repeat(depth) + trimmed + '\n';
    if (
      !trimmed.startsWith('</') &&
      !trimmed.startsWith('<?') &&
      !trimmed.startsWith('<!--') &&
      !trimmed.endsWith('/>') &&
      !trimmed.includes('</')
    ) {
      depth++;
    }
  }
  return result.trimEnd();
}

export function formatXml(xml: string): { result: string; error?: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const errEl = doc.querySelector('parsererror');
    if (errEl) {
      return { result: xml, error: 'Invalid XML — cannot format. Check syntax and try again.' };
    }
    const serializer = new XMLSerializer();
    const raw = serializer.serializeToString(doc);
    return { result: prettyPrint(raw) };
  } catch {
    return { result: xml, error: 'Could not format XML' };
  }
}

export function minifyXml(xml: string): { result: string; error?: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const errEl = doc.querySelector('parsererror');
    if (errEl) {
      return { result: xml, error: 'Invalid XML — cannot minify. Check syntax and try again.' };
    }
    const serializer = new XMLSerializer();
    const raw = serializer.serializeToString(doc);
    return { result: raw.replace(/>\s+</g, '><').trim() };
  } catch {
    return { result: xml, error: 'Could not minify XML' };
  }
}

export function validateXml(xml: string): { valid: boolean; error?: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const errEl = doc.querySelector('parsererror');
  if (errEl) {
    return { valid: false, error: errEl.textContent?.trim() ?? 'Invalid XML' };
  }
  return { valid: true };
}

export function wrapTag(fullText: string, selection: string, tag: string): string {
  if (!tag) return fullText;
  if (!selection) return fullText;
  return fullText.replace(selection, `<${tag}>${selection}</${tag}>`);
}

export function unwrapTag(fullText: string, selection: string): string {
  if (!selection) return fullText;
  const unwrapped = selection.replace(/^<[^>]+>([\s\S]*?)<\/[^>]+>$/, '$1');
  return fullText.replace(selection, unwrapped);
}

export function insertAtOffset(
  fullText: string,
  insertion: string,
  offset: number
): string {
  return fullText.slice(0, offset) + insertion + fullText.slice(offset);
}

export interface XPathMatch {
  start: number;
  end: number;
  text: string;
}

export function xpathSearch(
  xml: string,
  xpath: string
): { matches: XPathMatch[]; error?: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const errEl = doc.querySelector('parsererror');
    if (errEl) return { matches: [], error: 'Invalid XML' };

    const result = document.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
    const matches: XPathMatch[] = [];
    const serializer = new XMLSerializer();

    if (result.resultType === XPathResult.STRING_TYPE) {
      const str = result.stringValue;
      const idx = xml.indexOf(str);
      if (idx >= 0) matches.push({ start: idx, end: idx + str.length, text: str });
    } else {
      let node = result.iterateNext();
      while (node) {
        const nodeStr =
          node.nodeType === Node.TEXT_NODE
            ? (node.textContent ?? '')
            : serializer.serializeToString(node as Element);
        const idx = xml.indexOf(nodeStr);
        if (idx >= 0) matches.push({ start: idx, end: idx + nodeStr.length, text: nodeStr });
        node = result.iterateNext();
      }
    }
    return { matches };
  } catch (e) {
    return { matches: [], error: e instanceof Error ? e.message : 'XPath error' };
  }
}
