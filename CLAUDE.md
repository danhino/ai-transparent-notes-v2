# CLAUDE.md — AI Transparent Notes v2

## Stack

| Layer | Technology |
|---|---|
| Desktop runtime | Tauri 2.0 (Rust) |
| Frontend | React 19, TypeScript 5.8 |
| Build tool | Vite 7 |
| Editor | CodeMirror 6 |
| State | Zustand 5 |
| Animations | Framer Motion 12 |
| Diff | diff-match-patch |
| SQL formatting | sql-formatter 15 |
| Markdown rendering | marked |
| Icons | lucide-react |
| Styling | Tailwind CSS 4, CSS custom properties |

## Rust dependencies

- tauri 2 (features: tray-icon)
- tauri-plugin-fs 2 (features: watch)
- tauri-plugin-dialog, tauri-plugin-os, tauri-plugin-shell, tauri-plugin-opener
- tauri-plugin-single-instance 2
- reqwest 0.11 (features: json, rustls-tls)
- serde, serde_json, tokio

## App overview

Cross-platform desktop notes app (Windows, macOS, Linux) with:
- Up to 8 note tabs per pane
- Four layouts: Single, Side-by-Side, Top/Bottom, 2x2 Grid with draggable splitters
- Folder Workspace panel (left sidebar, collapsible, tree branch connector lines up to 5 levels deep)
- AI features: Fix, Polish, Rephrase, Convo, Spell Check, Suggest, Apply, Compare, HTML Viewer
- AI providers: Claude (Anthropic), OpenAI, DeepSeek, Ollama (local)
- Per-provider API key storage — each cloud provider stores its own key independently
- Ollama: auto-detect at 127.0.0.1:11434 via Rust invoke() commands (NOT frontend fetch), manual URL override, model list sorted by size with capability descriptions
- AI diff highlighting: green added, red removed, Accept/Revert banner in AiResultDialog
- Format toolbars: contextual two-row toolbars per format
- SQL: Format SQL (sql-formatter, Ctrl+Shift+F), dialect dropdown (Auto/MySQL/PostgreSQL/SQLite/T-SQL/PL/SQL), auto-detect on file open via sqlDetect.ts, passive validation indicator
- CSS: dedicated CssToolbar with Beautify/Minify (not Plain Text toolbar)
- RTF: WYSIWYG contenteditable editor (RichTextEditor.tsx), full two-row RtfToolbar, saves as .rtf via htmlToRtf()
- Status bar: char/word/line count, selection count, line ending (LF/CRLF/CR), UTF-8 label, AI-detected language badge, format/dialect label (right side)
- SQL status bar shows specific dialect (MySQL, PostgreSQL, T-SQL, PL/SQL, SQLite, SQL)
- Show All Characters toggle on most toolbars via showInvisiblesPlugin.ts
- Themes: Dark, Light, Blue, Sepia, Green via CSS custom properties
- Always on top, adjustable opacity (20-100%), Focus Mode, system tray
- Single instance via tauri-plugin-single-instance
- File auto-save (400ms debounce), file-backed notes write to source file on disk
- CSV table view toggle
- Comparison colors: clickable color pickers in Settings, live preview, Reset to defaults

## Platform accents
- Windows: blue accent #5a9cf7
- macOS: purple accent #7c6af7
- Detect via @tauri-apps/plugin-os, apply accent CSS variable

## File structure

```
src/
  types/index.ts           # All TypeScript types, AiProvider union, model constants, AppSettings
  styles.css               # All theme variables and component styles
  stores/
    noteStore.ts           # Notes, active tab, unsaved tracking, format auto-detect
    settingsStore.ts       # All persisted settings including per-provider API keys
    uiStore.ts             # Layout, panels, focus mode, per-pane UI state, paneDialect
  services/
    aiService.ts           # AI calls (all providers use invoke, not fetch)
    diffService.ts         # LCS-based line diff computation
    storageService.ts      # Tauri fs plugin read/write, settings migration
  utils/
    languageMap.ts         # CodeMirror language extension per format string
    csvParser.ts           # CSV row/column operations
    xmlUtils.ts            # XML format/minify/validate/XPath
    rtfParser.ts           # rtfToHtml(), htmlToRtf(), stripRtfTags()
    textUtils.ts           # HTML stripping for format switching
    toolbarUtils.ts        # Shared helpers for contextual toolbar actions
    sqlDetect.ts           # SQL dialect detection (T-SQL, PL/SQL, PostgreSQL, MySQL, SQLite)
    showInvisiblesPlugin.ts # CodeMirror ViewPlugin for invisible character rendering
  components/
    TitleBar.tsx / Toolbar.tsx / TabBar.tsx
    NoteEditor.tsx         # CodeMirror 6 wrapper
    RichTextEditor.tsx     # contenteditable RTF WYSIWYG editor
    AIToolbar.tsx / DiffView.tsx / AiResultDialog.tsx / DraggableList.tsx
    StatusBar.tsx / Pane.tsx / PaneSystem.tsx
    WorkspacePanel.tsx / SettingsDialog.tsx / CompareDialog.tsx
    JsonTreeView.tsx / CsvTableView.tsx
    RtfToolbar.tsx / CsvToolbar.tsx / XmlToolbar.tsx / MarkdownToolbar.tsx
    JsonToolbar.tsx / HtmlCssToolbar.tsx / SqlToolbar.tsx / PythonToolbar.tsx
    JsToolbar.tsx / CSharpToolbar.tsx / CppToolbar.tsx / JavaToolbar.tsx
    RustToolbar.tsx / ShellToolbar.tsx / CssToolbar.tsx / PlainTextToolbar.tsx
src-tauri/src/
  lib.rs                   # Tauri plugins, single-instance, tray icon, window events
  commands/
    ai.rs                  # call_ai, detect_ollama, fetch_ollama_models Tauri commands
    preview.rs             # HTML Viewer window — .transparent() is platform-gated:
                           # #[cfg(not(target_os = "macos"))] — do not remove this gate
    shell.rs
  capabilities/default.json
  tauri.conf.json          # productName: AI Transparent Notes
                           # identifier: com.danhi.ai-transparent-notes
```

## Conventions
- No em dashes in UI text or README — use commas or shorter sentences
- Sentence case for all labels and headings, never Title Case
- README.md must be updated after every code change
- Components -> src/components/
- Zustand stores -> src/stores/
- Tauri commands -> src-tauri/src/commands/
- Ollama HTTP calls go through Rust invoke() commands — do NOT use frontend fetch() for Ollama. Frontend fetch() from tauri://localhost origin is rejected by Ollama with HTTP 403 in production builds. detect_ollama and fetch_ollama_models are Rust commands in ai.rs.
- PKCS12 certificates must be exported with -legacy flag when using OpenSSL 3.x — macOS SecKeychainItemImport does not support AES-256-CBC (OpenSSL 3.x default), only RC2/3DES
- The .transparent() method on WebviewWindowBuilder is gated behind #[cfg(not(target_os = "macos"))] in preview.rs — do not remove this gate

## Known TODOs
- Find in Files: workspace panel right-click "Find in Files..." not yet implemented
- `let mut builder` warning in preview.rs:38 — mut is unused on macOS, can be cleaned with a cfg-gated declaration

## Release process

Update version in BOTH files before tagging (they must match):
- src-tauri/tauri.conf.json -> "version": "x.x.x"
- package.json -> "version": "x.x.x"

```bash
git add src-tauri/tauri.conf.json package.json
git commit -m "chore: bump version to vX.X.X"
git push
git tag vX.X.X
git push origin vX.X.X
```

Pushing a tag triggers GitHub Actions automatically — builds Windows, macOS (Intel + Apple Silicon, signed and notarized), and Linux, then creates a draft release. Review on the Releases page and publish when ready.

Never push a tag without updating the version in both files first.
