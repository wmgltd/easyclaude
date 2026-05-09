# EasyClaude

Multi-session terminal hub for Claude Code, backed by tmux.

EasyClaude is a macOS desktop app that lets you orchestrate many Claude Code sessions side-by-side — switch between them with `⌘1`–`⌘9` or a fuzzy palette, get notified when Claude needs your input, and (uniquely) **type and read Hebrew, Arabic, and other right-to-left scripts correctly** — a feature missing from VSCode, Cursor, Hyper, Tabby, and other xterm.js-based Electron terminals.

## Why

Claude Code is great. Running half a dozen of them in different tmux windows is not. EasyClaude makes that workflow sane:

- **All your sessions in one window.** Sidebar, ⌘+number to switch, drag-drop to reorder.
- **Survives app restarts.** tmux keeps the sessions alive in the background; EasyClaude re-attaches on launch and triggers a clean redraw so Claude's TUI doesn't double-render.
- **Awaiting alerts.** Detects when Claude is asking you a numbered-options question and chimes / fires a macOS notification / bumps the dock badge — only when the session is *not* the one you're focused on.
- **Hebrew/RTL support.** Words and sentences in Hebrew flow right-to-left as they should, mixed with English on the same line. This is implemented via a `MutationObserver` on xterm rows + targeted CSS — same architectural defect as every other xterm.js terminal, but actually solved.

## Features

- Create or import any existing tmux session
- Bookmark current point in any session (`⌘B`)
- Search inside the active terminal scrollback (`⌘F`)
- Command palette (`⌘K`) and session-only switcher (`⌘P`)
- Click a `path/to/file.ts:42` in the output → opens in Cursor / VSCode
- Click the colored dot next to a session name to recolor it
- Drag a session row to reorder
- Settings: themes (Default, Solarized Dark, Dracula, Nord, Light, Custom), font picker with Hebrew-friendly options, cursor style, notification sound + quiet hours, auto-bookmark on awaiting, default initial command and cwd

## Hebrew / RTL — the differentiator

xterm.js [issue #701](https://github.com/xtermjs/xterm.js/issues/701) ("Support RTL languages") has been open since 2017. Every Electron terminal that uses xterm.js inherits the gap: VSCode, Cursor, Hyper, Tabby, Wave Terminal, Mux. iTerm2 and WezTerm have their own open RTL bugs. Only macOS Terminal.app handles bidi properly out of the box — but it has no multi-session UX, no integration with Claude Code's TUI workflow.

EasyClaude solves this via:
- DOM renderer (no canvas pre-rasterization — lets the browser fall back through the font stack so Hebrew glyphs render)
- A `MutationObserver` that flags rows containing Hebrew/Arabic chars
- CSS `direction: rtl; unicode-bidi: isolate` on the spans inside flagged rows, so Hebrew flows right-to-left and English embedded inside isolates back to LTR

It's not a full UAX#9 implementation, but it covers the common cases (typing in the input field, reading Claude's Hebrew responses) cleanly enough that Israeli/Arabic-speaking developers can actually use Claude Code without giving up on their first language.

## Stack

- Electron 33 + Vite (electron-vite)
- React 18 + TypeScript
- xterm.js 5.5 (DOM renderer) with `addon-fit`, `addon-search`, `addon-clipboard`, `addon-web-links`
- node-pty for the actual PTY
- tmux (system-installed) as the session-persistence layer

## Building

Requires Node 20+ and tmux installed (`brew install tmux`).

```bash
npm install
npm run dev      # electron-vite dev with HMR
npm run pack     # local packaged .app at dist/mac-arm64/EasyClaude.app
npm run dist     # signed dmg + zip (needs Apple Developer ID)
```

## Author

Kobi Sela ([WMG](https://wmg.co.il)) — kobi@wmg.co.il

## License

UNLICENSED (private). Open-sourcing is on the table — open an issue if you want to use it.
