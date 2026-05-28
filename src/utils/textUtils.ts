export function stripHtml(content: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const text = doc.body.innerText ?? doc.body.textContent ?? '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
