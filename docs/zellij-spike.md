# Zellij spike — Mac, 2026-05-12

Goal: confirm Zellij 0.44.x has every CLI capability we currently use from
tmux, so we can build a `ZellijBackend` alongside the existing `TmuxBackend`
and unblock native Windows support without a self-built daemon.

Verdict: **viable**. All required capabilities work; the `subscribe` stream
is meaningfully better than tmux's polling. A few CLI gotchas to know.

## Environment

- macOS Apple Silicon
- `brew install zellij` → 0.44.2 (latest as of 2026-05-12)
- single 41 MB binary, no other dependencies

## Capability matrix

| Need (tmux today)                       | Zellij CLI                                                                          | Result | Notes |
| --------------------------------------- | ----------------------------------------------------------------------------------- | ------ | ----- |
| Create detached session                 | `zellij attach --create-background NAME`                                            | ✅     | Silent on success |
| Set cwd for that session                | `... options --default-cwd /path`                                                   | ⚠️     | Set, but doesn't propagate to panes spawned later via `new-pane`. Use `--cwd` per pane instead (see below). |
| Run initial command in a pane           | `zellij --session NAME action new-pane --cwd /path -- claude`                       | ✅     | Returns `terminal_N` on stdout — the pane id we'll use for everything else. |
| List sessions                           | `zellij list-sessions`                                                              | ✅     | Pretty text by default; no JSON flag on this command. |
| Kill a session                          | `zellij kill-session NAME` (singular)                                               | ✅     | Note: official docs sometimes say `kill-sessions` — CLI rejects that. |
| List panes with metadata                | `zellij --session NAME action list-panes --json`                                    | ✅     | Includes `terminal_command`, `exited`, `is_plugin`, `tab_id`. Filter out plugins. |
| Foreground command of a pane            | (in `list-panes --json` → `.terminal_command`)                                      | ✅     | Replaces tmux `display-message '#{pane_current_command}'`. |
| Capture current screen of a pane        | `zellij --session NAME action dump-screen --pane-id N --path /tmp/out.txt`          | ✅     | `--ansi` preserves color codes. Without `--pane-id`, output is empty. |
| **Real-time stream of pane updates**    | `zellij --session NAME subscribe --pane-id N --format json --ansi --scrollback`     | ✅✅   | **Event-driven NDJSON**. Initial event has full viewport (+ scrollback if requested). Subsequent events fire only on viewport change. `pane_closed` fires when pane exits. Replaces tmux's poll-`capture-pane` loop. |
| Resize / output stream / input          | `zellij attach NAME` over node-pty — same model as `tmux attach`                    | ✅     | Resize the attach pty → propagated. |
| Mouse passthrough                       | config `mouse_mode true`                                                            | ✅     | Set once, applies to all sessions. |

## Gotchas (must encode in `ZellijBackend`)

1. **`kill-session` is singular**, despite some doc references to `kill-sessions`.
2. **`--default-cwd` on session create doesn't apply to later `new-pane`** — every `new-pane` invocation must carry its own `--cwd`.
3. **`dump-screen` requires `--pane-id`** — without it, the dump is silently empty.
4. **`action send-keys` only accepts named keys** (`Ctrl a`, `Enter`, `F1`, etc.), not raw text. For initial commands we use `new-pane -- cmd`, which bypasses the shell. For user typing we pipe through the attach pty as we already do.
5. **Release-notes popup pane** appears as a plugin pane (`zellij:release_notes`) on first launch. Filter `is_plugin: true` out of `list-panes` parsing.

## `subscribe` event format

NDJSON, one event per line.

**Initial event (after subscribe):**
```json
{
  "event": "pane_update",
  "pane_id": "terminal_1",
  "is_initial": true,
  "viewport": ["...row 0 with ANSI...", "...row 1...", ...],
  "scrollback": ["...prior row 0...", "...prior row 1...", ...]
}
```

**Incremental updates:** same shape but `is_initial: false` and `scrollback: null`. Fires only when the visible buffer changes (no busy-loop / no polling).

**Pane closed:** `{"event": "pane_closed", "pane_id": "terminal_1"}` then the connection terminates.

## How this maps onto our existing `SessionBackend`

Map current TmuxManager methods to Zellij commands:

| TmuxManager method     | Zellij implementation                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `create({name, cwd})`  | `zellij attach --create-background N` → then `zellij --session N action new-pane --cwd CWD -- claude` (or whatever initialCommand) |
| `list()`               | metadata still lives in our own `sessions.json` (same as today)                                                                    |
| `listExternal()`       | `zellij list-sessions` (text parse) — only needed for the "Import existing" UI flow                                                |
| `kill(id)`             | `zellij kill-session N`                                                                                                            |
| `attach(id, cols, rows)` | `pty.spawn('zellij', ['attach', N])` — same shape as today, just different binary                                                  |
| `write(id, data)`      | write to the attach pty                                                                                                            |
| `resize(id, c, r)`     | resize the attach pty                                                                                                              |
| `captureLive(id)`      | `action dump-screen --pane-id N --ansi --path TMP` then read TMP                                                                   |
| `tickAwaiting`         | replace by long-lived `subscribe --pane-id N --format json` per session — event-driven, no polling                                 |
| `getPaneCurrentCommand` | parse from `list-panes --json` `terminal_command` field                                                                            |

## Build estimate (revised, post-spike)

Spike confirmed everything works. Sticking with the original 3-4 week estimate.

- **Week 1 (now)**: `SessionBackend` abstraction extracted from current `TmuxManager`. Build `ZellijBackend` against it. Mac dev test with one or two sessions.
- **Week 2**: Subscribe stream wired to status detection. Drop the polling timer. Audit edge cases.
- **Week 3**: Windows VM testing. Bundle Zellij binary in the installer (signed). Fix Windows-specific bugs encountered.
- **Week 4**: Migration tooling for existing Mac tmux users (auto-import on first launch with new backend). Documentation. Release v0.3.0 with dual-backend support.

## Spike artifacts

- Sample subscribe NDJSON: `/tmp/zellij-subscribe.ndjson`
- Sample dump-screen output: `/tmp/zellij-dump-2.txt`
- Sample scrollback dump: `/tmp/zellij-sub-scroll.ndjson`
