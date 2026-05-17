import type { NoteEditorRef } from './NoteEditor';
import {
  addRow,
  deleteRow,
  addCol,
  transposeCSV,
  sortCsv,
  changeDelimiter,
  getDelimiterChar,
} from '../utils/csvParser';
import type { Delimiter, CsvFormat } from '../types';

const FORMAT_OPTIONS: CsvFormat[] = [
  'General', 'Number', 'Currency', 'Percentage', 'Date', 'Time', 'Scientific', 'Text',
];

const DELIMITER_OPTIONS: Delimiter[] = ['Comma', 'Tab', 'Semicolon', 'Pipe'];

interface Props {
  editorRef: React.RefObject<NoteEditorRef | null>;
  disabled: boolean;
  hasHeader: boolean;
  delimiter: Delimiter;
  onHasHeaderChange: (v: boolean) => void;
  onDelimiterChange: (v: Delimiter) => void;
}

export function CsvToolbar({
  editorRef,
  disabled,
  hasHeader,
  delimiter,
  onHasHeaderChange,
  onDelimiterChange,
}: Props) {
  function getText() {
    return editorRef.current?.getText() ?? '';
  }

  function apply(newText: string) {
    editorRef.current?.applyText(newText);
  }

  function delChar() {
    return getDelimiterChar(delimiter);
  }

  function handleAddRow() {
    apply(addRow(getText(), delChar()));
  }

  function handleDeleteRow() {
    apply(deleteRow(getText(), delChar()));
  }

  function handleAddCol() {
    apply(addCol(getText(), delChar()));
  }

  function handleTranspose() {
    apply(transposeCSV(getText(), delChar()));
  }

  function handleSortAsc() {
    apply(sortCsv(getText(), true, hasHeader, delChar()));
  }

  function handleSortDesc() {
    apply(sortCsv(getText(), false, hasHeader, delChar()));
  }

  function handleDelimiterChange(newDelimiter: Delimiter) {
    const newChar = getDelimiterChar(newDelimiter);
    apply(changeDelimiter(getText(), delChar(), newChar));
    onDelimiterChange(newDelimiter);
  }

  const sep = <div className="ctx-toolbar-sep" />;
  const btnClass = (active: boolean) => `ctx-btn${active ? ' ctx-btn-active' : ''}`;

  return (
    <div className="contextual-toolbar">
      {/* Row 1 */}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" disabled={disabled} title="Merge selected cells (concatenate)">
          ⊞ Merge
        </button>

        {sep}

        <select
          className="ctx-select"
          disabled={disabled}
          title="Number format"
          style={{ width: 100 }}
        >
          {FORMAT_OPTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <button className="ctx-btn" disabled={disabled} title="Increase decimal places">
          .0+
        </button>
        <button className="ctx-btn" disabled={disabled} title="Decrease decimal places">
          .0-
        </button>

        {sep}

        <button className="ctx-btn" onClick={handleSortAsc} disabled={disabled} title="Sort A to Z">
          A→Z
        </button>
        <button className="ctx-btn" onClick={handleSortDesc} disabled={disabled} title="Sort Z to A">
          Z→A
        </button>
        <button className="ctx-btn" disabled={disabled} title="Toggle filter row">
          ▼ Filter
        </button>

        {sep}

        <button className="ctx-btn" onClick={handleAddRow} disabled={disabled} title="Insert row">
          +Row
        </button>
        <button className="ctx-btn" onClick={handleDeleteRow} disabled={disabled} title="Delete row">
          -Row
        </button>
      </div>

      {/* Row 2 */}
      <div className="ctx-toolbar-row">
        <button className="ctx-btn" onClick={handleAddCol} disabled={disabled} title="Insert column">
          +Col
        </button>

        {sep}

        <button
          className={btnClass(hasHeader)}
          onClick={() => onHasHeaderChange(!hasHeader)}
          disabled={disabled}
          title="Toggle header row"
        >
          Header
        </button>

        <button className="ctx-btn" onClick={handleTranspose} disabled={disabled} title="Transpose rows and columns">
          ⇄ Transpose
        </button>

        {sep}

        <span className="ctx-label">Sep:</span>
        <select
          className="ctx-select"
          value={delimiter}
          onChange={(e) => handleDelimiterChange(e.target.value as Delimiter)}
          disabled={disabled}
          title="Delimiter"
          style={{ width: 90 }}
        >
          {DELIMITER_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
