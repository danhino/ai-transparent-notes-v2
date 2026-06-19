# AI Transparent Notes

A cross-platform desktop notes app with multi-pane layouts, syntax-highlighted editing, AI writing tools, and transparent window support. Built with Tauri 2.0, React 19, and CodeMirror 6.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/multi-theme-syntax-highlighting.png" width="100%" alt="Multi theme with syntax highlighting in multi grid layouts"></td>
    <td width="50%"><img src="docs/screenshots/dark-theme-compare-dialog.png" width="100%" alt="Dark theme compare notes dialog showing diff view"></td>
  </tr>
  <tr>
    <td align="center">Multi theme, syntax highlighting</td>
    <td align="center">Dark theme, compare dialog</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/dark-theme-workspace-formats.png" width="100%" alt="Dark theme with workspace file tree and format dropdown"></td>
    <td width="50%"><img src="docs/screenshots/always-on-top-overlay.png" width="100%" alt="App in always-on-top transparent mode over a Teams meeting"></td>
  </tr>
  <tr>
    <td align="center">Workspace panel and format options</td>
    <td align="center">Always-on-top transparent overlay</td>
  </tr>
</table>

## Features

### Notes and tabs

- Up to 8 note tabs, renameable by double-clicking the tab label or clicking the pencil button in each pane
- Four layouts: single pane, side by side, top/bottom, and 2x2 grid
- Draggable dividers between panes; each pane has an independent note and format selector
- Per-pane export: save as `.txt`, `.md`, or the current format's native extension
- Auto-save with 400 ms debounce; file-backed notes write back to their source file on disk
- Scratch notes persist in settings; file-backed notes are opened via Import or workspace double-click
- Save indicator per pane: green "Saved" when clean, amber "↓ Save" when unsaved, muted "Saving..." during write — Ctrl+S also saves the focused pane
- Tab bar shows an amber dot on unsaved tabs and a colored language dot per format
- Hover a tab to see the full file path (file-backed notes) or creation timestamp (scratch notes)

### Workspace panel

- Collapsible left sidebar toggled from the main toolbar
- Add folders via button or drag a folder from Windows Explorer onto the window
- Lazy-loaded file tree with per-type icons — source files, documents, config, media, and archives each have a distinct emoji icon
- Single-click to highlight a file; double-click to open it in the active pane
- Right-click context menu: open in active pane, open in new tab, remove from workspace
- Duplicate tab detection: if a file is already open, focus switches to the existing tab
- Real-time file system sync via the Tauri watch plugin
- Resizable panel via drag handle
- Panel toolbar: Add folder, Expand all, Collapse all, Locate current file (expands ancestors, scrolls to, and briefly flashes the file open in the focused pane), Open in Explorer (reveals the selected file)
- Tree branch connector lines drawn at each depth level provide visual nesting guides up to five levels deep
- File path tooltip appears when hovering over a file for a short delay

### AI features

AI calls run from Rust via a `call_ai` Tauri command (reqwest), bypassing webview network restrictions. Four providers are supported: Claude (Anthropic), OpenAI, DeepSeek, and Ollama (local). Provider, model, and API key are configured in Settings. Each cloud provider stores its own API key independently, so switching providers does not lose a previously saved key.

| Action | Description |
|---|---|
| Fix | Finds and fixes syntax errors, logic errors, and bugs |
| Polish | Improves grammar, clarity, and flow without changing meaning |
| Rephrase | Rewrites text to be clearer and more concise |
| Convo | Rewrites in a natural, conversational tone |
| Spell check | Corrects spelling only, no other changes |
| Suggest | Suggests improvements or a natural continuation |
| Apply | Formats and cleans content using the selected format's rules |
| Auto-detect (Code) | Detects the programming language, formats the code, and shows the detected language in the status bar |
| Compare | Opens a side-by-side diff of two notes with AI summary, copy A↔B, and export |
| HTML Viewer | Renders the current note as a live webpage in a separate window |

After every AI action, a result dialog shows the original and result side by side with diff highlighting. Choose "Apply changes" to keep or "Revert" to discard. An optional AI summary can be generated, and changes can be exported as a `.diff` file.

AI errors appear as a red banner above the status bar, auto-dismissed after 8 seconds. Error messages distinguish: missing key, invalid key (401), rate limit (429), timeout, and network failure.

### Auto-detect

Opening a file from the workspace panel automatically selects the format using content-first detection: shebang lines, structural markers (XML declaration, JSON structure, HTML doctype), and language-specific code patterns are inspected first. File extension is used as a fallback when content is ambiguous.

### Editor

**Syntax highlighting** via CodeMirror 6:

Python, JavaScript, TypeScript, Java, C, C++, C#, Rust, SQL, HTML/CSS, CSS, Markdown, JSON, XML, Bash/Shell, PowerShell

Dark and Blue themes use the CodeMirror One Dark color scheme. Light, Sepia, and Green themes use the default light syntax colors. Switching themes reconfigures syntax highlighting instantly with no editor rebuild.

**Other editor features:**

- Line numbers: per-pane toggle in the pane header; default controlled in Settings and persisted per pane
- Resizable format dropdown and note title field via drag handles in each pane header
- CSV table view: a "Table" toggle renders the current CSV as a styled HTML table, updated with 400 ms debounce; auto-enabled when a `.csv` file is opened
- RTF format uses a `contenteditable` WYSIWYG editor — rich-text formatting is visible directly; no raw RTF syntax is exposed in the editing area
- Status bar (bottom of each pane): character count, word count, current line number, and selection count (characters selected); right side shows line ending type (LF/CRLF/CR), UTF-8 encoding label, AI-detected language badge (appears after Apply), and a language/dialect label that reflects the active format; for SQL files the label shows the specific dialect (MySQL, PostgreSQL, SQLite, T-SQL, PL/SQL, or generic SQL)
- Switching away from RTF or HTML-bearing formats automatically strips markup so the next editor receives clean plain text

### Format toolbars

Selecting most formats reveals a contextual toolbar immediately below the AI toolbar. It hides automatically when switching formats.

**RTF (two rows)** — Style (Normal, Heading 1–3, Title, Subtitle, Quote, Code), Bold, Italic, Underline, Strikethrough, Font family, Font size, Font color, Highlight color, Alignment; Wide margins toggle, Indent, Page size, Bullet/numbered lists, Insert table, Insert image placeholder, Horizontal rule, Formatting marks, Quick style, Clear formatting.

**CSV (two rows)** — Merge cells, Number format, Decimal places, Sort A-Z/Z-A, Filter row, Insert/delete row; Insert column, Header row toggle, Transpose, Delimiter selector (Comma/Tab/Semicolon/Pipe).

**XML (two rows)** — Wrap/unwrap tag, Collapse/expand all, Format, Minify, Validate; Add attribute, Insert child/sibling element, Insert comment/CDATA, Navigate Prev/Next/Parent, XPath search.

**Markdown (two rows)** — Bold, Italic, Strikethrough, Inline code, H1–H3, Link, Image, Preview toggle; Bullet list, Numbered list, Task list, Blockquote, Code block, Table template, TOC generator.

**JSON (two rows)** — Pretty print, Minify, Validate, Tree explorer toggle, Sort keys, Flatten to dot notation, Unflatten, Copy JSON path; Wrap/unwrap block comment, Wrap in array or object.

**HTML/CSS (two rows)** — HTML comment, Insert div/span/p/a, Emmet expander, Beautify, Minify, Preview toggle; CSS comment, Flexbox template, Grid template, Media query, Vendor prefix, CSS variable and `:root` templates.

**SQL (two rows)** — Format SQL via sql-formatter (Ctrl+Shift+F), dialect selector (Auto / MySQL / PostgreSQL / SQLite / T-SQL / PL/SQL; dialect is auto-detected from file content on open and updates the selector automatically), Minify, Uppercase/lowercase keywords, Block comment, Line comment, Uncomment, Statement/line count, Validate (toggles an inline error panel between the toolbar and the editor); passive ✓ Valid / ✗ Syntax error indicator at the far right of row 1 with 500 ms debounce; SELECT *, INSERT INTO, UPDATE, DELETE FROM, CREATE TABLE, full join/group/order query templates.

**Python (two rows)** — Comment/uncomment, Docstring wrapper, `def`/`class` templates; `if/elif/else`, `for`, `while`, `import`, `from/import`, list/dict comprehension, `try/except`, `with`, `lambda`, `print(f"")`.

**JavaScript / TypeScript (two rows)** — Line/block comment, Arrow function, async/await wrapper, `console.log`, `debugger`, `try/catch`; `import`, `export default function`, JSON.parse/stringify. TypeScript adds interface, type alias, and enum; JavaScript adds JSDoc and object literal.

**C# (two rows)** — Line/block comment, Namespace, Class, Interface, Auto property, Constructor; `try/catch/finally`, `using` block, async Task method, `await`, LINQ chain, `#region`.

**C / C++ (two rows)** — Line/block comment, `#include`, `#define`, `#ifdef` guard, `struct` (C++ adds `class`); `printf`/`cout`, `for`/`while` loops, memory allocation (`malloc`/`new` and `free`/`delete`), `NULL`/`nullptr`, `main` template.

**Java (two rows)** — Line/block comment, Javadoc, Class/Interface/Enum templates, `main` method; `try/catch/finally`, `for`, `for-each`, `while`, `System.out.println`, `@Override`, getter/setter pair.

**Rust (two rows)** — Line/block/doc comment, `fn`, `struct`, `impl`, `enum`, `pub`; `match`, `if let`, `Vec::new`, `HashMap`, `println!`, `.unwrap()`, `?` operator, `#[derive]`.

**Bash / PowerShell (two rows)** — Comment, `if` block, `for` loop, `while` loop, function template, `echo`/`Write-Host`; Pipe, redirect, append, variable declaration, `export`/`$env:`. Bash adds shebang inserter and `set -euo pipefail`; PowerShell adds `param()` block.

**CSS (one row)** — Beautify, Minify, Block comment/uncomment, var() reference, `:root` custom properties, Flexbox template, Grid template, @media query, Vendor prefix helper.

**Plain Text (one row)** — UPPER/lower/Title case, Sort A-Z/Z-A, Reverse lines, Deduplicate lines, Word/char/line count with read-time estimate, Trim whitespace, Add/remove 2-space indent.

The Plain Text toolbar also activates for Go, INI / Config, Log, and YAML / ENV formats.

Most contextual toolbars include a Show All Characters toggle (¶) that renders spaces as `·`, tabs as `→`, and line endings as `¶`.

### Inline split previews

Three formats open a live panel inside the editor area when their Preview button is clicked:

- **Markdown** — rendered HTML via `marked`, updated with 400 ms debounce
- **HTML/CSS** — live iframe rendering the note content
- **JSON** — collapsible tree explorer

### HTML Viewer

Select HTML Viewer from the format dropdown and click Apply to open the current note as a live webpage:

- Opens a separate 1000×700 resizable window
- Rendered via Tauri's internal asset server
- A temp file is written so "Open in browser" opens the exact content in the default browser
- Window opacity tracks the main window's opacity slider in real time
- Toolbar: Refresh, Open in browser, Close

### Window controls

- Frameless window with a custom titlebar (Windows/Linux: custom min/max/close; macOS: native traffic-lights space)
- Resizable, minimum 600×400
- Always on top toggle
- Opacity slider (20%–100%) with native window transparency; the main toolbar uses a frosted-glass effect to remain readable at low opacity
- Focus mode: hides all chrome (titlebar, toolbar, tab bar, workspace panel, pane headers, AI toolbars, status bars) so only the editor content is visible
- System tray: Show/Hide, New note, Exit

### Focus mode

Two floating controls appear in the top-right corner while focus mode is active:

- **Exit focus** — click to exit, or press Escape, or double-click the editor area
- **Move (⠿)** — drag to reposition the window using native OS dragging

Focus mode state persists across launches.

### Settings

The settings dialog is divided into these sections:

- **AI configuration** — provider (Claude/OpenAI/DeepSeek/Ollama), model dropdown filtered by provider with capability descriptions (Most capable / Balanced / Fastest), per-provider API key with show/hide toggle; Ollama shows a URL field with live connection status indicator and auto-detected model list sorted by size
- **Appearance** — theme, font family (12 options), font size (12 sizes), line numbers default; UI contrast subsection with sliders for text brightness, UI text size, and border opacity
- **AI toolbar** — drag-and-drop reorderable list of AI action buttons with ▲/▼ arrows and × remove
- **Main toolbar** — drag-and-drop reorderable list of main toolbar items
- **Format options** — drag-and-drop reorderable list; add custom formats, remove built-ins
- **Comparison colors** — clickable color swatches that open a native OS color picker; changes apply live to both the diff row backgrounds and the stat labels (added / deleted / changed); includes a Reset to defaults button
- **Storage** — data folder path with Open button to reveal in file manager
- **About** — app icon, description, version

A "Reset to defaults" button restores all settings.

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop runtime | Tauri 2.0 (Rust) |
| Frontend | React 19, TypeScript 5.8 |
| Build tool | Vite 7 |
| Editor | CodeMirror 6 |
| State | Zustand 5 |
| Animations | Framer Motion 12 |
| Diff | Custom LCS algorithm |
| SQL formatting | sql-formatter 15 |
| Markdown rendering | marked |
| Styling | Tailwind CSS 4, CSS custom properties |

---

## Project structure

```
src/
  types/index.ts           # All TypeScript types, defaults, and format option list
  styles.css               # Theme variables and all component styles
  stores/
    noteStore.ts           # Notes, active tab, unsaved tracking, format auto-detect
    settingsStore.ts       # All persisted settings
    uiStore.ts             # Layout, panels, focus mode, per-pane UI state
  services/
    aiService.ts           # AI API calls (Claude, OpenAI, DeepSeek, Ollama), all AI prompts
    diffService.ts         # Custom LCS-based line diff computation
    storageService.ts      # Tauri fs plugin read/write
  utils/
    languageMap.ts         # CodeMirror language extension per format string
    csvParser.ts           # CSV row/column operations
    xmlUtils.ts            # XML format/minify/validate/XPath utilities
    rtfParser.ts           # RTF to HTML and HTML to RTF conversion
    textUtils.ts           # HTML stripping for format switching
    toolbarUtils.ts        # Shared helpers for contextual toolbar actions
    sqlDetect.ts           # SQL dialect detection heuristics (T-SQL, PL/SQL, PostgreSQL, MySQL, SQLite)
  components/
    TitleBar.tsx           # Custom frameless titlebar with drag region
    Toolbar.tsx            # Main toolbar (pin, theme, font, opacity, layout, workspace, import, focus, settings)
    TabBar.tsx             # Tab bar with language dots, rename, unsaved indicator
    NoteEditor.tsx         # CodeMirror 6 wrapper with optional line numbers
    RichTextEditor.tsx     # contenteditable RTF editor
    AIToolbar.tsx          # Per-pane AI action buttons and format dropdown
    DiffView.tsx           # Shared side-by-side diff component
    AiResultDialog.tsx     # Modal shown after every AI action (diff, apply/revert, export)
    DraggableList.tsx      # Reusable drag-and-drop reorderable list
    StatusBar.tsx          # Chars, words, line number, selection count, line endings, encoding, detected-language badge, format/dialect label
    Pane.tsx               # Individual pane: editor, toolbars, status bar, AI orchestration
    PaneSystem.tsx         # Layout manager with draggable splitters
    WorkspacePanel.tsx     # Collapsible file tree sidebar with watch plugin
    SettingsDialog.tsx     # Settings modal
    CompareDialog.tsx      # Side-by-side diff with AI summary and copy/export
    JsonTreeView.tsx       # Collapsible JSON tree explorer
    CsvTableView.tsx       # Renders CSV content as a styled HTML table
    RtfToolbar.tsx         # RTF contextual toolbar (2 rows)
    CsvToolbar.tsx         # CSV contextual toolbar (2 rows)
    XmlToolbar.tsx         # XML contextual toolbar (2 rows)
    MarkdownToolbar.tsx    # Markdown contextual toolbar (2 rows)
    JsonToolbar.tsx        # JSON contextual toolbar (2 rows)
    HtmlCssToolbar.tsx     # HTML/CSS contextual toolbar (2 rows)
    SqlToolbar.tsx         # SQL contextual toolbar (2 rows)
    PythonToolbar.tsx      # Python contextual toolbar (2 rows)
    JsToolbar.tsx          # JavaScript/TypeScript contextual toolbar (2 rows)
    CSharpToolbar.tsx      # C# contextual toolbar (2 rows)
    CppToolbar.tsx         # C/C++ contextual toolbar (2 rows)
    JavaToolbar.tsx        # Java contextual toolbar (2 rows)
    RustToolbar.tsx        # Rust contextual toolbar (2 rows)
    ShellToolbar.tsx       # Bash/PowerShell contextual toolbar (2 rows)
    CssToolbar.tsx         # CSS contextual toolbar (1 row)
    PlainTextToolbar.tsx   # Plain Text contextual toolbar (1 row)
  App.tsx                  # Root: init, persistence, theme, focus mode, tray events
  main.tsx                 # React entry point
src-tauri/
  src/
    lib.rs                 # Tauri plugins, tray icon, window events
    main.rs                # Entry point
    commands/
      ai.rs                # call_ai Tauri command (reqwest HTTP to Claude/OpenAI/DeepSeek/Ollama)
      preview.rs           # HTML preview: open, close, sync opacity, open in browser
  capabilities/default.json  # Tauri permission grants
  tauri.conf.json          # App config: frameless window, tray, version
  icons/                   # App icons: icon.png, icon.ico, icon.icns, Windows Store assets
public/
  icon.png                 # Favicon for dev server
```

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [Rust](https://www.rust-lang.org/tools/install) stable toolchain
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform (WebView2 on Windows, Xcode on macOS)

### Installation

```bash
git clone https://github.com/danhino/ai-transparent-notes-v2
cd ai-transparent-notes-v2
npm install
```

### Run in development

```bash
npm run tauri dev
```

### Build for production

```bash
npm run tauri build
```

The installer is written to `src-tauri/target/release/bundle/`.

### Settings storage

Notes and settings are saved at:

- **Windows:** `%APPDATA%\com.danhi.ai-transparent-notes\settings.json`
- **macOS:** `~/Library/Application Support/com.danhi.ai-transparent-notes/settings.json`

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl/Cmd+S | Save the focused pane immediately |
| Ctrl/Cmd+Shift+T | Toggle toolbar collapse for the focused pane |
| Ctrl+Shift+F | Format SQL (when a SQL note is active) |
| Escape | Exit focus mode |

---

## Themes

Five built-in themes via CSS custom properties:

| Theme | Description |
|---|---|
| Dark | Near-black background, white text |
| Light | White background, dark text |
| Blue | Deep navy background, blue-tinted text |
| Sepia | Warm parchment background, brown text |
| Green | Dark green background, green-tinted text |

Platform accent color: blue (`#5a9cf7`) on Windows, purple (`#7c6af7`) on macOS.

---

## File support

Files opened from the workspace panel are automatically detected and assigned a format. Extension-to-format mapping:

| Icon | Extension(s) | Format |
|:---:|---|---|
| 🐍 | `.py` | Python |
| 📜 | `.js`, `.mjs` | JavaScript |
| 📘 | `.ts`, `.tsx` | TypeScript |
| ☕ | `.java` | Java |
| 🔵 | `.c`, `.h` | C |
| 🔷 | `.cpp`, `.cc`, `.cxx` | C++ |
| 🟣 | `.cs` | C# |
| 🦀 | `.rs` | Rust |
| 🐹 | `.go` | Go |
| 🗄️ | `.sql` | SQL |
| 🌐 | `.html`, `.htm` | HTML/CSS |
| 🎨 | `.css`, `.scss` | HTML/CSS |
| 📝 | `.md` | Markdown |
| 🔧 | `.json` | JSON |
| 📋 | `.xml` | XML |
| 📄 | `.rtf` | RTF |
| 📊 | `.csv` | CSV |
| 🖥️ | `.sh`, `.bash` | Bash |
| 💠 | `.ps1` | PowerShell |
| ⚙️ | `.yaml`, `.yml` | YAML / ENV |
| 🔐 | `.env` | INI / Config |
| 🔩 | `.ini`, `.cfg`, `.conf` | INI / Config |
| 🪵 | `.log` | Log |
| 📄 | `.txt` | Plain Text |

Any file type can be opened — unrecognised extensions fall back to Plain Text with no syntax highlighting.

The workspace panel also recognises images (🖼️), video (🎬), audio (🎵), archives (📦), executables (🔨), and many other file types with their own icons — these are displayed in the tree but do not open in the editor.

---

## AI setup

To use AI features, select a provider in Settings and enter the required credentials:

**Claude (Anthropic)** — [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key

**OpenAI** — [platform.openai.com](https://platform.openai.com) → API Keys → Create key

**DeepSeek** — [platform.deepseek.com](https://platform.deepseek.com) → API Keys → Create key

**Ollama (Local)** — Install from [ollama.com](https://ollama.com), run `ollama serve`, then pull a model (`ollama pull llama3.2`). No API key needed. The app auto-detects the running instance and lists available models.

Each cloud provider stores its own API key, so switching providers does not lose a previously entered key.

---

## Download and install

### Windows

1. Go to the [Releases page](https://github.com/danhino/ai-transparent-notes-v2/releases)
2. Download `ai-transparent-notes-v2_x64-setup.exe`
3. Double-click and follow the prompts
4. Launch from the Start menu or desktop shortcut

No additional software required. WebView2 installs automatically if not already present. Compatible with Windows 10 and Windows 11 (64-bit).

---

## License

MIT
