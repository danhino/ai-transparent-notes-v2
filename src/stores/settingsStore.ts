import { create } from 'zustand';
import { AppSettings, DEFAULT_SETTINGS, Theme, Layout, AiProvider } from '../types';

interface SettingsStore {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  update: (patch: Partial<AppSettings>) => void;
  setTheme: (theme: Theme) => void;
  setLayout: (layout: Layout) => void;
  setFontFamily: (v: string) => void;
  setFontSize: (v: number) => void;
  setWindowOpacity: (v: number) => void;
  setAlwaysOnTop: (v: boolean) => void;
  setAiProvider: (v: AiProvider) => void;
  setAiModel: (v: string) => void;
  setAiApiKey: (v: string) => void;
  setPaneNoteId: (paneIndex: number, noteId: string | null) => void;
  addWorkspaceFolder: (path: string) => void;
  removeWorkspaceFolder: (path: string) => void;
  setWorkspacePanelVisible: (v: boolean) => void;
  setWorkspacePanelWidth: (v: number) => void;
  setAiToolbarActions: (v: string[]) => void;
  setMainToolbarItems: (v: string[]) => void;
  setPaneLineNumbers: (paneIndex: number, v: boolean) => void;
  setShowLineNumbersByDefault: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: { ...DEFAULT_SETTINGS },

  setSettings: (settings) => set({ settings }),

  update: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  setTheme: (theme) =>
    set((s) => ({ settings: { ...s.settings, theme } })),

  setLayout: (layout) =>
    set((s) => ({ settings: { ...s.settings, layout } })),

  setFontFamily: (fontFamily) =>
    set((s) => ({ settings: { ...s.settings, fontFamily } })),

  setFontSize: (fontSize) =>
    set((s) => ({ settings: { ...s.settings, fontSize } })),

  setWindowOpacity: (windowOpacity) =>
    set((s) => ({ settings: { ...s.settings, windowOpacity } })),

  setAlwaysOnTop: (alwaysOnTop) =>
    set((s) => ({ settings: { ...s.settings, alwaysOnTop } })),

  setAiProvider: (aiProvider) =>
    set((s) => ({ settings: { ...s.settings, aiProvider } })),

  setAiModel: (aiModel) =>
    set((s) => ({ settings: { ...s.settings, aiModel } })),

  setAiApiKey: (aiApiKey) =>
    set((s) => ({ settings: { ...s.settings, aiApiKey } })),

  setPaneNoteId: (paneIndex, noteId) =>
    set((s) => {
      const paneNoteIds = [...s.settings.paneNoteIds];
      paneNoteIds[paneIndex] = noteId;
      return { settings: { ...s.settings, paneNoteIds } };
    }),

  addWorkspaceFolder: (path) =>
    set((s) => ({
      settings: {
        ...s.settings,
        workspaceFolders: s.settings.workspaceFolders.includes(path)
          ? s.settings.workspaceFolders
          : [...s.settings.workspaceFolders, path],
      },
    })),

  removeWorkspaceFolder: (path) =>
    set((s) => ({
      settings: {
        ...s.settings,
        workspaceFolders: s.settings.workspaceFolders.filter((f) => f !== path),
      },
    })),

  setWorkspacePanelVisible: (workspacePanelVisible) =>
    set((s) => ({ settings: { ...s.settings, workspacePanelVisible } })),

  setWorkspacePanelWidth: (workspacePanelWidth) =>
    set((s) => ({ settings: { ...s.settings, workspacePanelWidth } })),

  setAiToolbarActions: (aiToolbarActions) =>
    set((s) => ({ settings: { ...s.settings, aiToolbarActions } })),

  setMainToolbarItems: (mainToolbarItems) =>
    set((s) => ({ settings: { ...s.settings, mainToolbarItems } })),

  setPaneLineNumbers: (paneIndex, v) =>
    set((s) => {
      const paneLineNumbers = [...(s.settings.paneLineNumbers ?? [true, true, true, true])];
      paneLineNumbers[paneIndex] = v;
      return { settings: { ...s.settings, paneLineNumbers } };
    }),

  setShowLineNumbersByDefault: (showLineNumbersByDefault) =>
    set((s) => ({ settings: { ...s.settings, showLineNumbersByDefault } })),
}));
