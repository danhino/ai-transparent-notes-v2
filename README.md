# AI Transparent Notes v2

A cross-platform desktop notes app with multi-pane layouts, AI writing tools, and real-time diff highlighting. Built with Tauri 2.0, React 19, TypeScript, and CodeMirror 6.

## Features

### Notes and tabs
- Up to 8 note tabs, renameable by double-click on the tab label
- Per-pane rename button (pencil icon) next to the note selector for inline rename
- Per-pane export button (↓ icon) with options: export as .txt, .md, or current format extension
- Saved/Unsaved indicator in the pane header, right-aligned: green "Saved" or amber "Unsaved"
- Scratch notes (stored in settings) and file-backed notes (written to disk on save)
- Auto-save with 400ms debounce per pane

### Layouts
- Single pane, side by side, top/bottom, and 2x2 grid
- Draggable dividers between panes
- Each pane has an independent note selector

### Syntax highlighting

Selecting a format from the Format dropdown immediately applies CodeMirror syntax highlighting for that language, before clicking Apply. Supported languages:

Python, JavaScript, TypeScript, Java, C, C++, C# (via legacy mode), Rust, SQL, HTML/CSS, CSS, Markdown, JSON, Bash/Shell, PowerShell

Dark and Blue themes use the CodeMirror oneDark color scheme. Light, Sepia, and Green themes use the default light syntax colors. Changing themes reconfigures the syntax colors instantly via compartment reconfiguration — no editor rebuild.

When Auto-detect (Code) Apply completes and the user accepts the result, the detected language is applied to the highlighter and shown in the status bar.

### AI features
- Supported providers: Claude (Anthropic) and OpenAI
- API calls made from Rust via a `call_ai` Tauri command (reqwest), bypassing webview network restrictions entirely
- AI toolbar layout: `AI: | Format: [dropdown] [Apply] | [Fix] [Spell check] [Rephrase] [Compare] [Suggest] [Polish]` — scrolls horizontally on narrow windows
- Actions: Fix, Polish, Rephrase, Spell check, Suggest, Compare; Apply runs whatever format is selected in the dropdown
- "Auto-detect (Code)" is a format option; selecting it and clicking Apply detects the language, formats the code, and shows "Detected: [Language]" in the status bar
- Actions work on selected text or the full note
- After every AI action: a modal dialog opens showing the original and AI result side by side (Compare-style view) with diff stats (+added, -deleted, changed), synchronized scrolling, and line numbers. User chooses Apply changes or Revert. An optional AI summary can be generated.
- Export diff button saves the changes as a .diff file
- Changing the format selection resets the detected language label
- AI errors shown as a red banner above the status bar in the affected pane; auto-dismisses after 8 seconds or on click
- Error messages distinguish: no API key, invalid key (401), rate limit (429), timeout (120s), network failure

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
- Opacity slider (20% to 100%) — uses native window transparency via Tauri's transparent window mode
- Focus mode: hides all UI except editor content for distraction-free writing
- System tray with Show/Hide, New note, Exit

### Focus mode

Focus mode hides all chrome: titlebar, toolbar, tab bar, workspace panel, per-pane headers, AI toolbars, and status bars. Only the CodeMirror editor fills the window. To exit:

- Click the **Exit focus** pill button in the top-right corner (appears semi-transparent, fully visible on hover)
- Press **Escape**
- Double-click anywhere on the editor area

The Focus button in the toolbar shows an active/highlighted state while focus mode is on. Focus mode state is persisted to settings so it restores on next launch.

### Line numbers
- Each pane has a `#` toggle button in its header to show or hide line numbers independently
- Default: line numbers visible; persisted per pane in settings
- Global default in Settings under Appearance: "Show line numbers by default" checkbox

### HTML Viewer
- Select "HTML Viewer" from the format dropdown and click Apply to open the current note as a live webpage
- HTML is rendered in an iframe inside a dedicated `preview.html` window served by Tauri's internal asset server
- A temp file is also written so "Open in browser" opens the exact content in the default system browser via the file:// URL
- Opens a separate 1000x700 resizable window titled "HTML Preview"
- Toolbar: Refresh (reloads the iframe with the last-sent content), Open in browser (opens temp file in default browser), Close
- All toolbar buttons use the Tauri IPC bridge, which is reliably available in internal app windows
- Non-blocking: main window stays usable while preview is open

### Settings
- Dialog is fixed-size (560px wide, max 90vh tall), scrollable, centered; only the Cancel or X button closes it
- Each section has a bold accent-colored title and a 12px description line beneath it
- AI configuration: provider (Claude or OpenAI), model filtered by provider, API key with eye-icon show/hide toggle, helper link to API keys page
- Appearance: theme (Dark, Light, Blue, Sepia, Green), font family (12 options), font size (14 sizes), show line numbers by default checkbox
- AI toolbar: reorderable list of per-pane AI action buttons; click row to select, up/down/remove/add actions. Default order: Format/Apply, Fix, Spell check, Rephrase, Compare, Suggest, Polish
- Main toolbar: reorderable list of toolbar items with up/down/remove/add; click row to select
- Format options: reorderable list with add, remove, and reorder; includes Auto-detect (Code) and HTML Viewer by default
- Comparison colors: hex inputs with live color swatch preview for added, deleted, and changed lines
- Storage: data folder path (read-only) with Open button to reveal in file manager
- About: app icon (64x64), app name, description, version from tauri.conf.json
- Section headers are bold and accent-colored with separator lines between sections
- All form controls are 32px tall for consistent alignment
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
    NoteEditor.tsx        # CodeMirror 6 wrapper with optional line numbers
    AIToolbar.tsx         # Per-pane AI action buttons
    DiffView.tsx          # Shared side-by-side diff component (CSS grid, line numbers, sync scroll)
    AiResultDialog.tsx    # Modal shown after every AI action with apply/revert/export
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
    commands/
      ai.rs               # call_ai Tauri command (reqwest HTTP to Claude/OpenAI)
      preview.rs          # HTML preview commands (temp file, open, close, open in browser)
  capabilities/default.json  # Tauri permission grants
  tauri.conf.json         # App config: frameless window, tray
  icons/
    app-icon.svg          # Source icon (1024x1024 SVG, generated via `npx tauri icon`)
    icon.png              # 512x512 base PNG (auto-generated)
    icon.ico              # Windows multi-size ICO (auto-generated)
    icon.icns             # macOS ICNS (auto-generated)
    32x32.png, 128x128.png, 128x128@2x.png  # Tauri bundle PNGs
    Square*.png, StoreLogo.png  # Windows Store assets
public/
  icon.png               # Copy of 512x512 icon for browser tab favicon
  icon.ico               # Copy of ICO for browser tab favicon
```

## Download and install (Windows)

1. Go to the [Releases page](https://github.com/danhino/ai-transparent-notes/releases)
2. Download `ai-transparent-notes-v2_x64-setup.exe`
3. Double-click and follow the prompts
4. Launch from the Start menu

Compatible with Windows 10 and Windows 11 (64-bit). All dependencies install automatically, including WebView2 if it is not already present.

## Build from source

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
