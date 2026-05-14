import { useRef, useState, useEffect, useCallback } from 'react';
import { NoteEditor, NoteEditorRef } from './NoteEditor';
import { AIToolbar } from './AIToolbar';
import { DiffBanner } from './DiffBanner';
import { StatusBar } from './StatusBar';
import { useNoteStore } from '../stores/noteStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { computeLineDiff } from '../services/diffService';
import { runAction, runApply } from '../services/aiService';
import { writeSourceFile } from '../services/storageService';

const SAVE_DEBOUNCE_MS = 400;
const DIFF_SECONDS = 30;

interface Props {
  paneIndex: number;
}

export function Pane({ paneIndex }: Props) {
  const editorRef = useRef<NoteEditorRef>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diffTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { notes, updateNote, markSaved } = useNoteStore();
  const { settings } = useSettingsStore();
  const setPaneNoteId = useSettingsStore((s) => s.setPaneNoteId);
  const {
    focusedPaneIndex,
    paneStates,
    setFocusedPane,
    setPaneBusy,
    setPaneDetectedLanguage,
    setPaneDiff,
    tickPaneDiffCountdown,
    setPaneSavedVisible,
  } = useUiStore();

  const noteId = settings.paneNoteIds[paneIndex] ?? null;
  const note = notes.find((n) => n.id === noteId) ?? null;
  const paneState = paneStates[paneIndex];
  const isFocused = focusedPaneIndex === paneIndex;

  const [selectedFormat, setSelectedFormat] = useState(settings.formatOptions[0] ?? 'Plain text');
  const [lineNumber, setLineNumber] = useState(1);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  // Update status bar counts when note content changes
  useEffect(() => {
    const content = note?.content ?? '';
    setCharCount(content.length);
    setWordCount(content.trim() ? content.trim().split(/\s+/).length : 0);
  }, [note?.content]);

  // Clear diff countdown when note switches
  useEffect(() => {
    return () => {
      if (diffTimerRef.current) clearInterval(diffTimerRef.current);
    };
  }, [noteId]);

  function startDiffCountdown() {
    if (diffTimerRef.current) clearInterval(diffTimerRef.current);
    diffTimerRef.current = setInterval(() => {
      tickPaneDiffCountdown(paneIndex);
    }, 1000);
  }

  function stopDiffCountdown() {
    if (diffTimerRef.current) {
      clearInterval(diffTimerRef.current);
      diffTimerRef.current = null;
    }
  }

  // Auto-accept when countdown hits 0
  useEffect(() => {
    if (paneState.diff === null) {
      stopDiffCountdown();
    }
  }, [paneState.diff]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleEditorChange(text: string) {
    if (!note) return;
    // User typing = implicit accept of diff
    if (paneState.diff) {
      acceptDiff();
    }
    updateNote(note.id, { content: text });
    setCharCount(text.length);
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);

    // Debounced save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePersist(note.id, text);
    }, SAVE_DEBOUNCE_MS);
  }

  async function savePersist(id: string, content: string) {
    const n = useNoteStore.getState().notes.find((x) => x.id === id);
    if (n?.sourceFilePath) {
      try {
        await writeSourceFile(n.sourceFilePath, content);
      } catch {
        // ignore write errors
      }
    }
    markSaved(id);
    setPaneSavedVisible(paneIndex, true);
    setTimeout(() => setPaneSavedVisible(paneIndex, false), 1500);
  }

  function getWorkingText(): string {
    const view = editorRef.current;
    if (!view) return note?.content ?? '';
    if (view.hasSelection()) return view.getSelection();
    return view.getText();
  }

  function replaceWithResult(original: string, result: string, wasSelection: boolean) {
    const view = editorRef.current;
    if (!view || !note) return;
    const pre = wasSelection ? view.getText() : original;
    const post = wasSelection
      ? view.getText().replace(original, result)
      : result;
    const blocks = computeLineDiff(pre, post);
    view.applyDiff(post, blocks, settings.diffAddedColor, settings.diffChangedColor);
    updateNote(note.id, { content: post });
    setPaneDiff(paneIndex, {
      preSnapshot: pre,
      postSnapshot: post,
      diffBlocks: blocks,
      countdown: DIFF_SECONDS,
    });
    startDiffCountdown();
  }

  const handleAction = useCallback(
    async (action: 'fix' | 'polish' | 'rephrase' | 'spellcheck' | 'suggest' | 'apply' | 'compare') => {
      if (!note || paneState.isBusy) return;

      if (action === 'compare') {
        useUiStore.getState().setCompareOpen(true);
        return;
      }

      const wasSelection = editorRef.current?.hasSelection() ?? false;
      const text = getWorkingText();
      if (!text.trim()) return;

      setPaneBusy(paneIndex, true);
      try {
        if (action === 'apply') {
          const { result, detectedLanguage } = await runApply(text, selectedFormat, settings);
          replaceWithResult(text, result, wasSelection);
          if (detectedLanguage) {
            setPaneDetectedLanguage(paneIndex, detectedLanguage);
          }
        } else {
          const result = await runAction(action, text, settings);
          replaceWithResult(text, result, wasSelection);
        }
      } catch (err) {
        console.error('AI action failed:', err);
      } finally {
        setPaneBusy(paneIndex, false);
      }
    },
    [note, paneState.isBusy, selectedFormat, settings, paneIndex] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function acceptDiff() {
    stopDiffCountdown();
    setPaneDiff(paneIndex, null);
    editorRef.current?.clearDiff();
  }

  function revertDiff() {
    if (!paneState.diff || !note) return;
    stopDiffCountdown();
    const pre = paneState.diff.preSnapshot;
    editorRef.current?.applyText(pre);
    updateNote(note.id, { content: pre });
    setPaneDiff(paneIndex, null);
    editorRef.current?.clearDiff();
  }

  const content = note?.content ?? '';

  return (
    <div
      className={`pane${isFocused ? ' focused' : ''}`}
      onClick={() => setFocusedPane(paneIndex)}
    >
      {/* Note selector */}
      <div className="pane-header">
        <select
          className="pane-note-select"
          value={noteId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setPaneNoteId(paneIndex, val || null);
          }}
        >
          <option value="">-- no note --</option>
          {notes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
      </div>

      {/* AI toolbar */}
      <AIToolbar
        paneIndex={paneIndex}
        disabled={paneState.isBusy || !note}
        selectedFormat={selectedFormat}
        onFormatChange={setSelectedFormat}
        onAction={handleAction}
      />

      {/* Diff banner */}
      {paneState.diff && (
        <DiffBanner diff={paneState.diff} onAccept={acceptDiff} onRevert={revertDiff} />
      )}

      {/* Editor */}
      <NoteEditor
        ref={editorRef}
        content={content}
        fontFamily={settings.fontFamily}
        fontSize={settings.fontSize}
        detectedLanguage={paneState.detectedLanguage}
        onChange={handleEditorChange}
        onLineChange={setLineNumber}
      />

      {/* Busy overlay */}
      {paneState.isBusy && (
        <div className="busy-overlay">
          <div className="spinner" />
        </div>
      )}

      {/* Status bar */}
      <StatusBar
        charCount={charCount}
        wordCount={wordCount}
        lineNumber={lineNumber}
        detectedLanguage={paneState.detectedLanguage}
        savedVisible={paneState.savedVisible}
      />
    </div>
  );
}
