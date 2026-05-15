import { useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useUiStore } from '../stores/uiStore';
import { useNoteStore } from '../stores/noteStore';
import { useSettingsStore } from '../stores/settingsStore';
import { computeLineDiff } from '../services/diffService';
import { runDiffSummary } from '../services/aiService';
import { DiffBlock } from '../types';
import { DiffView } from './DiffView';

export function CompareDialog() {
  const setCompareOpen = useUiStore((s) => s.setCompareOpen);
  const { notes } = useNoteStore();
  const settings = useSettingsStore((s) => s.settings);
  const focusedPaneIndex = useUiStore((s) => s.focusedPaneIndex);

  const currentNoteId = settings.paneNoteIds[focusedPaneIndex];
  const currentNote = notes.find((n) => n.id === currentNoteId);
  const otherNotes = notes.filter((n) => n.id !== currentNoteId);

  const [compareNoteId, setCompareNoteId] = useState(otherNotes[0]?.id ?? '');
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const noteA = currentNote;
  const noteB = notes.find((n) => n.id === compareNoteId);

  const blocks: DiffBlock[] = noteA && noteB ? computeLineDiff(noteA.content, noteB.content) : [];

  async function getSummary() {
    if (!noteA || !noteB || summaryLoading) return;
    setSummaryLoading(true);
    try {
      const text = await runDiffSummary(noteA.content, noteB.content, settings);
      setSummary(text);
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
    if (!blocks.length || !noteA || !noteB) return;
    const lines: string[] = [`--- ${noteA.title}`, `+++ ${noteB.title}`, ''];
    for (const block of blocks) {
      if (block.type === 'equal') block.linesA.forEach((l) => lines.push('  ' + l));
      else if (block.type === 'added') block.linesB.forEach((l) => lines.push('+ ' + l));
      else if (block.type === 'deleted') block.linesA.forEach((l) => lines.push('- ' + l));
      else if (block.type === 'changed') {
        block.linesA.forEach((l) => lines.push('- ' + l));
        block.linesB.forEach((l) => lines.push('+ ' + l));
      }
    }
    try {
      const savePath = await save({
        defaultPath: `${noteA.title}_vs_${noteB.title}.diff`,
        filters: [
          { name: 'Diff files', extensions: ['diff'] },
          { name: 'Text files', extensions: ['txt'] },
        ],
      });
      if (savePath && typeof savePath === 'string') {
        await writeTextFile(savePath, lines.join('\n'));
      }
    } catch (err) {
      console.error('[CompareDialog] Export failed:', err);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setCompareOpen(false)}>
      <div className="modal modal-lg" style={{ maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Compare notes</span>
          <button className="modal-close" onClick={() => setCompareOpen(false)}>×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 20px', gap: 12, flex: 1 }}>
          {/* Note selector */}
          <div className="settings-row" style={{ marginBottom: 0, flexShrink: 0 }}>
            <span className="settings-label" style={{ minWidth: 80 }}>B — Compare with:</span>
            <select
              className="settings-select"
              value={compareNoteId}
              onChange={(e) => { setCompareNoteId(e.target.value); setSummary(''); }}
            >
              {otherNotes.map((n) => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
          </div>

          {/* Diff view */}
          {noteA && noteB ? (
            <DiffView
              labelA={noteA.title}
              labelB={noteB.title}
              blocks={blocks}
              addedColor={settings.diffAddedColor}
              deletedColor={settings.diffDeletedColor}
              leftChangedColor={settings.diffChangedColor}
              rightChangedColor={settings.diffChangedColor}
            />
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 8 }}>
              Select a note to compare.
            </div>
          )}

          {/* AI summary */}
          <div style={{ flexShrink: 0 }}>
            {summary ? (
              <div className="compare-summary">{summary}</div>
            ) : (
              <button
                className="settings-btn"
                onClick={getSummary}
                disabled={!noteB || summaryLoading}
                style={{ fontSize: 12 }}
              >
                {summaryLoading ? 'Summarizing...' : 'AI summary'}
              </button>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="settings-btn" onClick={copyAtoB} disabled={!noteB}>Copy A to B</button>
            <button className="settings-btn" onClick={copyBtoA} disabled={!noteB}>Copy B to A</button>
            <button className="settings-btn" onClick={exportDiff} disabled={!blocks.length}>Export diff</button>
          </div>
          <button className="settings-btn primary" onClick={() => setCompareOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
