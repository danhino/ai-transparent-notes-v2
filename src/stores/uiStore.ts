import { create } from 'zustand';
import { Platform } from '../types';

export type MarkdownPreviewLayout = 'off' | 'bottom' | 'side';

export interface PaneUiState {
  isBusy: boolean;
  detectedLanguage: string | null;
  savedVisible: boolean;
  paneDialect: string;
  markdownPreviewLayout: MarkdownPreviewLayout;
  aiPaletteOpen: boolean;
  aiChatOpen: boolean;
  formatToolbarCollapsed: boolean;
}

const makePaneState = (): PaneUiState => ({
  isBusy: false,
  detectedLanguage: null,
  savedVisible: false,
  paneDialect: 'sql',
  markdownPreviewLayout: 'off',
  aiPaletteOpen: false,
  aiChatOpen: false,
  formatToolbarCollapsed: false,
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
  setPaneSavedVisible: (i: number, v: boolean) => void;
  setPaneDialect: (i: number, dialect: string) => void;
  setPaneMarkdownPreviewLayout: (i: number, layout: MarkdownPreviewLayout) => void;
  setPaneAiPaletteOpen: (i: number, v: boolean) => void;
  setPaneAiChatOpen: (i: number, v: boolean) => void;
  setPaneFormatToolbarCollapsed: (i: number, v: boolean) => void;
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

  setPaneSavedVisible: (i, savedVisible) =>
    set((s) => ({ paneStates: patchPane(s.paneStates, i, { savedVisible }) })),

  setPaneDialect: (i, paneDialect) =>
    set((s) => ({ paneStates: patchPane(s.paneStates, i, { paneDialect }) })),

  setPaneMarkdownPreviewLayout: (i, markdownPreviewLayout) =>
    set((s) => ({ paneStates: patchPane(s.paneStates, i, { markdownPreviewLayout }) })),

  setPaneAiPaletteOpen: (i, aiPaletteOpen) =>
    set((s) => ({ paneStates: patchPane(s.paneStates, i, { aiPaletteOpen }) })),

  setPaneAiChatOpen: (i, aiChatOpen) =>
    set((s) => ({ paneStates: patchPane(s.paneStates, i, { aiChatOpen }) })),

  setPaneFormatToolbarCollapsed: (i, formatToolbarCollapsed) =>
    set((s) => ({ paneStates: patchPane(s.paneStates, i, { formatToolbarCollapsed }) })),

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setCompareOpen: (compareOpen) => set({ compareOpen }),
  setPlatform: (platform) => set({ platform }),
}));
