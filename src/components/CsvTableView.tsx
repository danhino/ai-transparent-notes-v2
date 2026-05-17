import { useState, useEffect, useMemo } from 'react';
import { parseCsv } from '../utils/csvParser';

interface Props {
  content: string;
  delimiter?: string;
  hasHeader?: boolean;
  filterText?: string;
}

export function CsvTableView({ content, delimiter = ',', hasHeader = false, filterText = '' }: Props) {
  const [debouncedContent, setDebouncedContent] = useState(content);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedContent(content), 400);
    return () => clearTimeout(t);
  }, [content]);

  const { headerRow, dataRows } = useMemo(() => {
    const rows = parseCsv(debouncedContent, delimiter);
    if (!rows.length || (rows.length === 1 && rows[0].every((c) => !c))) {
      return { headerRow: null, dataRows: [] };
    }
    if (hasHeader && rows.length > 0) {
      return { headerRow: rows[0], dataRows: rows.slice(1) };
    }
    return { headerRow: null, dataRows: rows };
  }, [debouncedContent, delimiter, hasHeader]);

  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return dataRows;
    const lower = filterText.toLowerCase();
    return dataRows.filter((row) => row.some((cell) => cell.toLowerCase().includes(lower)));
  }, [dataRows, filterText]);

  if (!headerRow && filteredRows.length === 0) {
    return (
      <div className="csv-table-empty">No data to display</div>
    );
  }

  return (
    <div className="csv-table-wrap">
      <table className="csv-table">
        {headerRow && (
          <thead>
            <tr>
              {headerRow.map((cell, i) => (
                <th key={i} className="csv-th">{cell || ' '}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {filteredRows.map((row, r) => (
            <tr key={r} className={r % 2 === 0 ? 'csv-row-even' : 'csv-row-odd'}>
              {row.map((cell, c) => (
                <td key={c} className="csv-td">{cell || ' '}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
