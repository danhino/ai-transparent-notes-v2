const DELIMITER_MAP: Record<string, string> = {
  Comma: ',',
  Tab: '\t',
  Semicolon: ';',
  Pipe: '|',
};

export function getDelimiterChar(name: string): string {
  return DELIMITER_MAP[name] ?? ',';
}

export function parseCsv(text: string, delimiter = ','): string[][] {
  if (!text.trim()) return [[]];
  return text.split('\n').map((row) => row.split(delimiter));
}

export function stringifyCsv(rows: string[][], delimiter = ','): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(delimiter) || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(delimiter)
    )
    .join('\n');
}

export function addRow(text: string, delimiter = ','): string {
  const rows = parseCsv(text, delimiter);
  const colCount = rows[0]?.length ?? 1;
  rows.push(Array(colCount).fill(''));
  return stringifyCsv(rows, delimiter);
}

export function deleteRow(text: string, delimiter = ','): string {
  const rows = parseCsv(text, delimiter);
  if (rows.length <= 1) return text;
  rows.pop();
  return stringifyCsv(rows, delimiter);
}

export function addCol(text: string, delimiter = ','): string {
  const rows = parseCsv(text, delimiter);
  return stringifyCsv(rows.map((row) => [...row, '']), delimiter);
}

export function transposeCSV(text: string, delimiter = ','): string {
  const rows = parseCsv(text, delimiter);
  if (!rows.length) return text;
  const maxCols = Math.max(...rows.map((r) => r.length));
  const transposed: string[][] = [];
  for (let c = 0; c < maxCols; c++) {
    transposed.push(rows.map((r) => r[c] ?? ''));
  }
  return stringifyCsv(transposed, delimiter);
}

export function sortCsv(
  text: string,
  ascending = true,
  hasHeader = false,
  delimiter = ','
): string {
  const rows = parseCsv(text, delimiter);
  if (rows.length <= (hasHeader ? 2 : 1)) return text;
  const header = hasHeader ? [rows[0]] : [];
  const data = hasHeader ? rows.slice(1) : rows;
  const sorted = [...data].sort((a, b) => {
    const cmp = (a[0] ?? '').localeCompare(b[0] ?? '');
    return ascending ? cmp : -cmp;
  });
  return stringifyCsv([...header, ...sorted], delimiter);
}

export function changeDelimiter(
  text: string,
  fromDelimiter: string,
  toDelimiter: string
): string {
  const rows = parseCsv(text, fromDelimiter);
  return stringifyCsv(rows, toDelimiter);
}

export function formatCell(value: string, format: string): string {
  const num = parseFloat(value);
  switch (format) {
    case 'Number':
      return isNaN(num) ? value : num.toFixed(2);
    case 'Currency':
      return isNaN(num) ? value : `$${num.toFixed(2)}`;
    case 'Percentage':
      return isNaN(num) ? value : `${(num * 100).toFixed(1)}%`;
    case 'Text':
      return String(value);
    default:
      return value;
  }
}

export function applyFormatToColumn(
  text: string,
  colIndex: number,
  format: string,
  hasHeader = false,
  delimiter = ','
): string {
  const rows = parseCsv(text, delimiter);
  const startRow = hasHeader ? 1 : 0;
  for (let r = startRow; r < rows.length; r++) {
    if (rows[r][colIndex] !== undefined) {
      rows[r][colIndex] = formatCell(rows[r][colIndex], format);
    }
  }
  return stringifyCsv(rows, delimiter);
}

export function adjustDecimalPlaces(value: string, increase: boolean): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  const match = value.match(/\.(\d+)/);
  const currentDecimals = match ? match[1].length : 0;
  const newDecimals = increase
    ? Math.min(currentDecimals + 1, 8)
    : Math.max(currentDecimals - 1, 0);
  return num.toFixed(newDecimals);
}
