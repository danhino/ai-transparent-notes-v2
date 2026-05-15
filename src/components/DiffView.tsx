import { DiffBlock } from '../types';
import { diffStats } from '../services/diffService';

interface Props {
  labelA: string;
  labelB: string;
  blocks: DiffBlock[];
  addedColor: string;
  deletedColor: string;
  leftChangedColor: string;
  rightChangedColor: string;
}

export function DiffView({ labelA, labelB, blocks, addedColor, deletedColor, leftChangedColor, rightChangedColor }: Props) {
  const stats = diffStats(blocks);

  // Build rows with tracked line numbers per side
  let leftNum = 0;
  let rightNum = 0;

  const rows = blocks.map((block, idx) => {
    const leftLines: { num: number; text: string }[] = [];
    const rightLines: { num: number; text: string }[] = [];

    if (block.type === 'equal') {
      block.linesA.forEach((l) => leftLines.push({ num: ++leftNum, text: l }));
      block.linesB.forEach((l) => rightLines.push({ num: ++rightNum, text: l }));
    } else if (block.type === 'deleted') {
      block.linesA.forEach((l) => leftLines.push({ num: ++leftNum, text: l }));
    } else if (block.type === 'added') {
      block.linesB.forEach((l) => rightLines.push({ num: ++rightNum, text: l }));
    } else if (block.type === 'changed') {
      block.linesA.forEach((l) => leftLines.push({ num: ++leftNum, text: l }));
      block.linesB.forEach((l) => rightLines.push({ num: ++rightNum, text: l }));
    }

    const leftBg =
      block.type === 'deleted' ? deletedColor :
      block.type === 'changed' ? leftChangedColor : 'transparent';
    const rightBg =
      block.type === 'added' ? addedColor :
      block.type === 'changed' ? rightChangedColor : 'transparent';

    return { idx, leftLines, rightLines, leftBg, rightBg };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 8, flexShrink: 0 }}>
        <span style={{ color: 'var(--success)' }}>+{stats.added} added</span>
        <span style={{ color: 'var(--danger)' }}>-{stats.deleted} deleted</span>
        <span style={{ color: 'var(--warning)' }}>{stats.changed} changed</span>
        {stats.added === 0 && stats.deleted === 0 && stats.changed === 0 && (
          <span style={{ color: 'var(--text-secondary)' }}>No differences</span>
        )}
      </div>

      {/* Diff container */}
      <div style={{
        flex: 1, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 4,
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1px 1fr',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
          background: 'var(--toolbar-bg)',
        }}>
          <div style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {labelA}
          </div>
          <div style={{ background: 'var(--border)' }} />
          <div style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {labelB}
          </div>
        </div>

        {/* Scrollable diff grid */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', minWidth: 480 }}>
            {rows.map(({ idx, leftLines, rightLines, leftBg, rightBg }) => [
              <div
                key={`l${idx}`}
                style={{
                  background: leftBg,
                  fontFamily: "'Cascadia Code','Consolas',monospace",
                  fontSize: 12,
                  lineHeight: 1.5,
                  padding: '0 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {leftLines.map(({ num, text }, j) => (
                  <div key={j} style={{ display: 'flex', padding: '0 0' }}>
                    <span style={{
                      color: 'var(--subtle-text)', userSelect: 'none', flexShrink: 0,
                      minWidth: 36, textAlign: 'right', padding: '1px 6px 1px 4px',
                      borderRight: '1px solid var(--border)', fontSize: 11,
                    }}>{num}</span>
                    <span style={{ padding: '1px 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1 }}>
                      {text || ' '}
                    </span>
                  </div>
                ))}
              </div>,
              <div key={`d${idx}`} style={{ background: 'var(--border)' }} />,
              <div
                key={`r${idx}`}
                style={{
                  background: rightBg,
                  fontFamily: "'Cascadia Code','Consolas',monospace",
                  fontSize: 12,
                  lineHeight: 1.5,
                  padding: '0 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {rightLines.map(({ num, text }, j) => (
                  <div key={j} style={{ display: 'flex', padding: '0 0' }}>
                    <span style={{
                      color: 'var(--subtle-text)', userSelect: 'none', flexShrink: 0,
                      minWidth: 36, textAlign: 'right', padding: '1px 6px 1px 4px',
                      borderRight: '1px solid var(--border)', fontSize: 11,
                    }}>{num}</span>
                    <span style={{ padding: '1px 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1 }}>
                      {text || ' '}
                    </span>
                  </div>
                ))}
              </div>,
            ])}
          </div>
        </div>
      </div>
    </div>
  );
}
