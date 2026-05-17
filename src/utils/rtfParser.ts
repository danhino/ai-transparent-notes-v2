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

export function applyRtfStyle(text: string, style: string): string {
  switch (style) {
    case 'Heading 1': return `# ${text}`;
    case 'Heading 2': return `## ${text}`;
    case 'Heading 3': return `### ${text}`;
    case 'Title': return `**${text}**`;
    case 'Subtitle': return `_${text}_`;
    case 'Quote': return `> ${text}`;
    case 'Code': return `\`${text}\``;
    default: return text;
  }
}

export function toggleBold(fullText: string, selection: string): string {
  if (!selection) return fullText;
  const marker = `**${selection}**`;
  if (fullText.includes(marker)) return fullText.replace(marker, selection);
  return fullText.replace(selection, marker);
}

export function toggleItalic(fullText: string, selection: string): string {
  if (!selection) return fullText;
  const marker = `_${selection}_`;
  if (fullText.includes(marker)) return fullText.replace(marker, selection);
  return fullText.replace(selection, marker);
}

export function toggleUnderline(fullText: string, selection: string): string {
  if (!selection) return fullText;
  const marker = `<u>${selection}</u>`;
  if (fullText.includes(marker)) return fullText.replace(marker, selection);
  return fullText.replace(selection, marker);
}

export function toggleStrikethrough(fullText: string, selection: string): string {
  if (!selection) return fullText;
  const marker = `~~${selection}~~`;
  if (fullText.includes(marker)) return fullText.replace(marker, selection);
  return fullText.replace(selection, marker);
}

export function clearFormatting(fullText: string, selection: string): string {
  const target = selection || fullText;
  const cleaned = target
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/<u>(.*?)<\/u>/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#{1,3} /gm, '')
    .replace(/^> /gm, '');
  if (!selection) return cleaned;
  return fullText.replace(selection, cleaned);
}

export function insertHorizontalRule(fullText: string, cursorOffset: number): string {
  return fullText.slice(0, cursorOffset) + '\n---\n' + fullText.slice(cursorOffset);
}

export function insertAsciiTable(rows: number, cols: number): string {
  const cellWidth = 10;
  const hLine = '+' + Array(cols).fill('-'.repeat(cellWidth)).join('+') + '+';
  const dataRow = '|' + Array(cols).fill(' '.repeat(cellWidth)).join('|') + '|';
  const lines = [hLine];
  for (let r = 0; r < rows; r++) {
    lines.push(dataRow);
    lines.push(hLine);
  }
  return '\n' + lines.join('\n') + '\n';
}

export function toggleBulletList(fullText: string, selection: string): string {
  const target = selection || fullText;
  const lines = target.split('\n');
  const hasBullets = lines.every((l) => l.startsWith('• ') || l.trim() === '');
  const toggled = lines
    .map((l) => {
      if (l.trim() === '') return l;
      return hasBullets ? l.replace(/^• /, '') : `• ${l}`;
    })
    .join('\n');
  if (!selection) return toggled;
  return fullText.replace(selection, toggled);
}

export function toggleNumberedList(fullText: string, selection: string): string {
  const target = selection || fullText;
  const lines = target.split('\n');
  const hasNumbers = lines.every((l) => /^\d+\. /.test(l) || l.trim() === '');
  let counter = 0;
  const toggled = lines
    .map((l) => {
      if (l.trim() === '') return l;
      counter++;
      return hasNumbers ? l.replace(/^\d+\. /, '') : `${counter}. ${l}`;
    })
    .join('\n');
  if (!selection) return toggled;
  return fullText.replace(selection, toggled);
}

export function changeIndent(fullText: string, selection: string, increase: boolean): string {
  const target = selection || fullText;
  const lines = target.split('\n');
  const indented = lines
    .map((l) => (increase ? `  ${l}` : l.replace(/^  /, '')))
    .join('\n');
  if (!selection) return indented;
  return fullText.replace(selection, indented);
}
