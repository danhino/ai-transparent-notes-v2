import { useState } from 'react';
import { useUiStore } from '../stores/uiStore';
import { useNoteStore } from '../stores/noteStore';
import { useSettingsStore } from '../stores/settingsStore';
import { computeLineDiff, diffStats } from '../services/diffService';
import { runDiffSummary } from '../services/aiService';
import { DiffBlock } from '../types';

function renderLines(blocks: DiffBlock[], side: 'A' | 'B') {
  const lines: { text: string; cls: string }[] = [];
  for (const block of blocks) {
    if (block.type === 'equal') {
      (side === 'A' ? block.linesA : block.linesB).forEach((l) =>
        lines.push({ text: l, cls: '' })
      );
    } else if (block.type === 'added' && side === 'B') {
      block.linesB.forEach((l) => lines.push({ text: l, cls: 'added' }));
    } else if (block.type === 'deleted' && side === 'A') {
      block.linesA.forEach((l) => lines.push({ text: l, cls: 'deleted' }));
    } else if (block.type === 'changed') {
      if (side === 'A') block.linesA.forEach((l) => lines.push({ text: l, cls: 'changed' }));
      else block.linesB.forEach((l) => lines.push({ text: l, cls: 'changed' }));
    }
  }
  return lines;
}

export function CompareDialog() {
  const setCompareOpen = useUiStore((s) => s.setCompareOpen);
  const { notes } = useNoteStore();
  const { settings, focusedPaneIndex } = {
    settings: useSettingsStore((s) => s.settings),
    focusedPaneIndex: useUiStore((s) => s.focusedPaneIndex),
  };

  const currentNoteId = settings.paneNoteIds[focusedPaneIndex];
  const currentNote = notes.find((n) => n.id === currentNoteId);
  const otherNotes = notes.filter((n) => n.id !== currentNoteId);

  const [compareNoteId, setCompareNoteId] = useState(otherNotes[0]?.id ?? '');
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const noteA = currentNote;
  const noteB = notes.find((n) => n.id === compareNoteId);

  const blocks = noteA && noteB ? computeLineDiff(noteA.content, noteB.content) : [];
  const stats = diffStats(blocks);

  const linesA = renderLines(blocks, 'A');
  const linesB = renderLines(blocks, 'B');

  async function getSummary() {
    if (!noteA || !noteB || summaryLoading) return;
    setSummaryLoading(true);
    try {
      const result = await runDiffSummary(noteA.content, noteB.content, settings);
      setSummary(result);
    } catch {
      setSummary('Failed to generate summary.');
    } finally {
      setSummaryLoading(false);
    }
  }

  function copyAtoB() {
    if (!noteA || !noteB) return;
    const { updateNote } = useNoteStore.getState();
    updateNote(noteB.id, { content: noteA.content });
  }

  function copyBtoA() {
    if (!noteA || !noteB) return;
    const { updateNote } = useNoteStore.getState();
    updateNote(noteA.id, { content: noteB.content });
  }

  async function exportDiff() {
    if (!blocks.length) return;
    const lines: string[] = [];
    for (const block of blocks) {
      if (block.type === 'equal') block.linesA.forEach((l) => lines.push('  ' + l));
      else if (block.type === 'added') block.linesB.forEach((l) => lines.push('+ ' + l));
      else if (block.type === 'deleted') block.linesA.forEach((l) => lines.push('- ' + l));
      else if (block.type === 'changed') {
        block.linesA.forEach((l) => lines.push('- ' + l));
        block.linesB.forEach((l) => lines.push('+ ' + l));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diff.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-overlay" onClick={() => setCompareOpen(false)}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Compare notes</span>
          <button className="modal-close" onClick={() => setCompareOpen(false)}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Note selector */}
          <div className="settings-row" style={{ marginBottom: 12 }}>
            <span className="settings-label" style={{ minWidth: 80 }}>
              Compare with:
            </span>
            <select
              className="settings-select"
              value={compareNoteId}
              onChange={(e) => {
                setCompareNoteId(e.target.value);
                setSummary('');
              }}
            >
              {otherNotes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </div>

          {/* Stats */}
          {noteB && (
            <div className="compare-stats">
              <span style={{ color: 'var(--success)' }}>+{stats.added} added</span>
              <span style={{ color: 'var(--danger)' }}>-{stats.deleted} deleted</span>
              <span style={{ color: 'var(--accent)' }}>{stats.changed} changed</span>
            </div>
          )}

          {/* Side-by-side diff */}
          {noteA && noteB && (
            <div className="compare-grid">
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {noteA.title}
                </div>
                <div className="compare-pane">
                  {linesA.map((l, i) => (
                    <div key={i} className={`compare-line${l.cls ? ' ' + l.cls : ''}`}>
                      {l.text || ' '}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {noteB.title}
                </div>
                <div className="compare-pane">
                  {linesB.map((l, i) => (
                    <div key={i} className={`compare-line${l.cls ? ' ' + l.cls : ''}`}>
                      {l.text || ' '}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI summary */}
          {summary && <div className="compare-summary">{summary}</div>}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="settings-btn" onClick={copyAtoB} disabled={!noteB}>
              Copy A to B
            </button>
            <button className="settings-btn" onClick={copyBtoA} disabled={!noteB}>
              Copy B to A
            </button>
            <button className="settings-btn" onClick={exportDiff} disabled={!blocks.length}>
              Export diff
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="settings-btn"
              onClick={getSummary}
              disabled={!noteB || summaryLoading}
            >
              {summaryLoading ? 'Summarizing...' : 'AI summary'}
            </button>
            <button className="settings-btn primary" onClick={() => setCompareOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
