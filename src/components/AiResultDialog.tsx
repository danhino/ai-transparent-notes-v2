import { useState, useEffect } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { DiffView } from './DiffView';
import { computeLineDiff } from '../services/diffService';
import { runAiResultSummary } from '../services/aiService';
import { AppSettings, DiffBlock } from '../types';

interface Props {
  actionName: string;
  original: string;
  result: string;
  settings: AppSettings;
  onApply: () => void;
  onClose: () => void;
}

export function AiResultDialog({ actionName, original, result, settings, onApply, onClose }: Props) {
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const blocks: DiffBlock[] = computeLineDiff(original, result);

  const addedColor = settings.diffAddedColor;
  const deletedColor = settings.diffDeletedColor;

  async function getSummary() {
    if (summaryLoading) return;
    setSummaryLoading(true);
    try {
      const text = await runAiResultSummary(original, result, settings);
      setSummary(text);
    } catch {
      setSummary('Failed to generate summary.');
    } finally {
      setSummaryLoading(false);
    }
  }

  async function exportDiff() {
    const lines: string[] = [`--- Original`, `+++ AI Result (${actionName})`, ''];
    for (const block of blocks) {
      if (block.type === 'equal') block.linesA.forEach((l) => lines.push('  ' + l));
      else if (block.type === 'added') block.linesB.forEach((l) => lines.push('+ ' + l));
      else if (block.type === 'deleted') block.linesA.forEach((l) => lines.push('- ' + l));
      else if (block.type === 'changed') {
        block.linesA.forEach((l) => lines.push('- ' + l));
        block.linesB.forEach((l) => lines.push('+ ' + l));
      }
    }
    const content = lines.join('\n');

    try {
      const savePath = await save({
        defaultPath: `ai_${actionName.toLowerCase().replace(/\s+/g, '_')}.diff`,
        filters: [
          { name: 'Diff files', extensions: ['diff'] },
          { name: 'Text files', extensions: ['txt'] },
        ],
      });
      if (savePath && typeof savePath === 'string') {
        await writeTextFile(savePath, content);
      }
    } catch (err) {
      console.error('[AiResultDialog] Export failed:', err);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-lg"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">AI Result — {actionName}</span>
          <button
            className="diff-dialog-close"
            onClick={onClose}
            title="Close"
            aria-label="Close comparison"
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 20px', gap: 12, flex: 1 }}>
          <DiffView
            labelA="Original"
            labelB="AI Result"
            blocks={blocks}
            addedColor={addedColor}
            deletedColor={deletedColor}
            leftChangedColor={deletedColor}
            rightChangedColor={addedColor}
          />

          {/* AI Summary */}
          <div style={{ flexShrink: 0 }}>
            {summary ? (
              <div className="compare-summary">{summary}</div>
            ) : (
              <button
                className="settings-btn"
                onClick={getSummary}
                disabled={summaryLoading}
                style={{ fontSize: 12 }}
              >
                {summaryLoading ? 'Summarizing...' : 'Get AI summary'}
              </button>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="settings-btn" onClick={exportDiff}>
            Export diff
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="settings-btn" onClick={onClose}>
              Revert
            </button>
            <button className="settings-btn primary" onClick={onApply}>
              Apply changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
