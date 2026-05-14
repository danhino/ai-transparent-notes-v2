# CLAUDE.md — AI Transparent Notes v2

## Stack
- Tauri 2.0 (Rust backend), React 19, TypeScript, Vite 6
- CodeMirror 6 for the editor (replaces AvalonEdit)
- Zustand for state management
- Framer Motion for animations
- diff-match-patch for AI diff highlighting
- Tailwind CSS 4 for styling

## App overview
Cross-platform (Windows + macOS) notes app with:
- Max 4 note tabs
- Multi-pane layouts: Single, Side-by-Side, Top/Bottom, 2x2 Grid
- Folder as Workspace panel (left sidebar, collapsible)
- AI features: Fix, Polish, Rephrase, Spell Check, Suggest, Apply,
  Compare — via Claude (Anthropic) and OpenAI APIs
- AI diff highlighting: green added, red removed, Accept/Revert banner,
  auto-accept after 30s countdown
- Auto-detect language shown in status bar after Apply
- Themes: Dark, Light, Blue, Sepia, Green via CSS custom properties
- Always on top, adjustable opacity, Focus Mode, system tray
- File open/save writes back to source file; scratch notes use
  local storage
- FileSystemWatcher via Tauri watch plugin for real-time workspace sync

## Platform accents
- Windows: blue accent #5a9cf7
- macOS: purple accent #7c6af7
- Detect platform via Tauri os plugin and apply accent CSS variable

## Conventions
- No em dashes in UI text or README — use commas or shorter sentences
- Sentence case for all labels and headings, never Title Case
- README.md must be updated after every code change to reflect
  current features, structure, and stack
- Components go in src/components/
- Zustand stores go in src/stores/
- Tauri commands go in src-tauri/src/commands/

## Reference implementation
The original WPF app is at github.com/danhino/ai-transparent-notes.
Use it as logic reference for AI prompts, diff behavior, storage
schema, and theme color values — not for UI patterns.