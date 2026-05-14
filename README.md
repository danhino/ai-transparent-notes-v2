# AI Transparent Notes v2

A cross-platform desktop notes app with multi-pane layouts, AI writing tools, and real-time diff highlighting. Built with Tauri 2.0, React 19, TypeScript, and CodeMirror 6.

## Features

### Notes and tabs
- Up to 4 note tabs, renameable by double-click
- Unsaved indicator dot on tab label
- Scratch notes (stored in settings) and file-backed notes (written to disk on save)
- Auto-save with 400ms debounce per pane

### Layouts
- Single pane, side by side, top/bottom, and 2x2 grid
- Draggable dividers between panes
- Each pane has an independent note selector

### AI features
- Supported providers: Claude (Anthropic) and OpenAI
- Actions: Fix, Polish, Rephrase, Spell check, Suggest, Apply (format), Compare
- Actions work on selected text or the full note
- After every AI action: diff is computed (LCS line-level), changes highlighted inline in green and yellow, Accept/Revert banner shown with 30-second auto-accept countdown
- Typing in the editor implicitly accepts the diff
- Apply action detects language automatically when "Auto-detect (Code)" is selected

### Workspace panel
- Collapsible left sidebar toggled from toolbar
- Add folders via button or right-click menu
- Lazy-loaded file tree with language icons
- Single-click to highlight, double-click to open file in active pane
- Right-click context menu: open in active pane, open in new tab, remove from workspace
- Duplicate tab detection (switches to existing tab instead of reopening)
- Real-time file system sync via Tauri watch plugin
- Resizable panel via drag handle

### Themes
Five built-in themes via CSS custom properties: Dark, Light, Blue, Sepia, Green. Platform accent color: blue on Windows, purple on macOS.

### Window controls
- Frameless window with custom titlebar (Windows/Linux: custom min/max/close; macOS: native traffic lights space)
- Resizable window with minimum size 600x400
- Always on top toggle
- Opacity slider (0.2 to 1.0)
- Focus mode: hides all UI except editor content for distraction-free writing
- System tray with Show/Hide, New note, Exit

### Focus mode

Focus mode hides all chrome: titlebar, toolbar, tab bar, workspace panel, per-pane headers, AI toolbars, and status bars. Only the CodeMirror editor fills the window. To exit:

- Click the **Exit focus** pill button in the top-right corner (appears semi-transparent, fully visible on hover)
- Press **Escape**
- Double-click anywhere on the editor area

The Focus button in the toolbar shows an active/highlighted state while focus mode is on. Focus mode state is persisted to settings so it restores on next launch.

### Settings
- AI configuration: provider (Claude or OpenAI), model filtered by provider, API key with show/hide toggle, helper link to API keys page
- Appearance: theme (Dark, Light, Blue, Sepia, Green), font family (12 options), font size (14 sizes)
- AI toolbar: reorderable list of per-pane AI action buttons with up, down, remove, and add
- Main toolbar: reorderable list of toolbar items with up, down, remove, and add
- Format options: reorderable list with add, remove, and reorder; defaults match the original WPF app
- Comparison colors: hex inputs with live color swatch preview for added, deleted, and changed lines
- Storage: app data folder path with Open button to reveal in file manager
- About: app name, description, version
- Reset to defaults button restores all settings to original values

## Tech stack

| Layer | Technology |
|---|---|
| Desktop runtime | Tauri 2.0 (Rust) |
| Frontend | React 19, TypeScript |
| Build tool | Vite 6 |
| Editor | CodeMirror 6 |
| State | Zustand 5 |
| Diff | Custom LCS algorithm |
| Styling | Tailwind CSS 4, CSS custom properties |

## Project structure

```
src/
  types/index.ts          # All TypeScript types and defaults
  styles.css              # Theme variables and component styles
  stores/
    noteStore.ts          # Notes, active tab, unsaved tracking
    settingsStore.ts      # All persisted settings
    uiStore.ts            # Layout, panels, focus, per-pane diff state
  services/
    aiService.ts          # Claude and OpenAI API calls
    diffService.ts        # LCS-based line diff computation
    storageService.ts     # Tauri fs plugin read/write
  components/
    TitleBar.tsx          # Custom frameless titlebar with drag region
    Toolbar.tsx           # Main toolbar (pin, theme, font, opacity, layout, files)
    TabBar.tsx            # Tab bar with rename, close, add
    NoteEditor.tsx        # CodeMirror 6 wrapper with diff decorations
    AIToolbar.tsx         # Per-pane AI action buttons
    DiffBanner.tsx        # Accept/Revert banner with countdown
    StatusBar.tsx         # Chars, words, line number, detected language
    Pane.tsx              # Individual pane orchestrating all pane components
    PaneSystem.tsx        # Layout manager with draggable splitters
    WorkspacePanel.tsx    # Collapsible file tree sidebar
    SettingsDialog.tsx    # Settings modal
    CompareDialog.tsx     # Side-by-side diff with AI summary
  App.tsx                 # Root: init, persistence, theme, tray events
  main.tsx                # React entry point
src-tauri/
  src/
    lib.rs                # Tauri plugins, tray icon, window events
    main.rs               # Entry point
  capabilities/default.json  # Tauri permission grants
  tauri.conf.json         # App config: frameless window, tray
```

## Setup

### Prerequisites
- [Rust](https://rustup.rs)
- [Node.js 18+](https://nodejs.org)
- Tauri CLI: `cargo install tauri-cli` or `npm install -D @tauri-apps/cli`

### Install dependencies

```bash
npm install
```

### Development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

### Settings storage

Settings and scratch notes are saved to the OS app data directory:
- Windows: `%APPDATA%\com.danhi.ai-transparent-notes\settings.json`
- macOS: `~/Library/Application Support/com.danhi.ai-transparent-notes/settings.json`

### AI API keys

Set your API key in Settings (gear icon in the toolbar). Keys are stored in settings.json in the app data directory.

## Reference

This is a full rebuild of the original WPF app at [github.com/danhino/ai-transparent-notes](https://github.com/danhino/ai-transparent-notes). AI prompts, diff behavior, storage schema, and theme colors match the original implementation.
