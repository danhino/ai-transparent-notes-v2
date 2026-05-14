import { create } from 'zustand';
import { DiffBlock, Platform } from '../types';

export interface PaneDiffState {
  preSnapshot: string;
  postSnapshot: string;
  diffBlocks: DiffBlock[];
  countdown: number;
}

export interface PaneUiState {
  isBusy: boolean;
  detectedLanguage: string | null;
  diff: PaneDiffState | null;
  savedVisible: boolean;
}

const makePaneState = (): PaneUiState => ({
  isBusy: false,
  detectedLanguage: null,
  diff: null,
  savedVisible: false,
});

interface UiStore {
  focusMode: boolean;
  focusedPaneIndex: number;
  paneStates: PaneUiState[];
  settingsOpen: boolean;
  compareOpen: boolean;
  platform: Platform;

  setFocusMode: (v: boolean) => void;
  setFocusedPane: (index: number) => void;
  setPaneBusy: (i: number, v: boolean) => void;
  setPaneDetectedLanguage: (i: number, lang: string | null) => void;
  setPaneDiff: (i: number, diff: PaneDiffState | null) => void;
  tickPaneDiffCountdown: (i: number) => void;
  setPaneSavedVisible: (i: number, v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setCompareOpen: (v: boolean) => void;
  setPlatform: (v: Platform) => void;
}

function patchPane(states: PaneUiState[], i: number, patch: Partial<PaneUiState>): PaneUiState[] {
  return states.map((ps, idx) => (idx === i ? { ...ps, ...patch } : ps));
}

export const useUiStore = create<UiStore>((set) => ({
  focusMode: false,
  focusedPaneIndex: 0,
  paneStates: [makePaneState(), makePaneState(), makePaneState(), makePaneState()],
  settingsOpen: false,
  compareOpen: false,
  platform: 'windows',

  setFocusMode: (focusMode) => set({ focusMode }),

  setFocusedPane: (focusedPaneIndex) => set({ focusedPaneIndex }),

  setPaneBusy: (i, isBusy) =>
    set((s) => ({ paneStates: patchPane(s.paneStates, i, { isBusy }) })),

  setPaneDetectedLanguage: (i, detectedLanguage) =>
    set((s) => ({ paneStates: patchPane(s.paneStates, i, { detectedLanguage }) })),

  setPaneDiff: (i, diff) =>
    set((s) => ({ paneStates: patchPane(s.paneStates, i, { diff }) })),

  tickPaneDiffCountdown: (i) =>
    set((s) => {
      const ps = s.paneStates[i];
      if (!ps.diff) return s;
      const countdown = ps.diff.countdown - 1;
      const diff = countdown <= 0 ? null : { ...ps.diff, countdown };
      return { paneStates: patchPane(s.paneStates, i, { diff }) };
    }),

  setPaneSavedVisible: (i, savedVisible) =>
    set((s) => ({ paneStates: patchPane(s.paneStates, i, { savedVisible }) })),

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setCompareOpen: (compareOpen) => set({ compareOpen }),
  setPlatform: (platform) => set({ platform }),
}));
