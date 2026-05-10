import { useEffect, useState } from 'react'
import type { ExternalTmuxSession } from '../types'
import { CodeBlock } from './CodeBlock'

const COLORS = ['#10b981', '#7c3aed', '#ec4899', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']

interface Props {
  onImport: (opts: { tmuxName: string; displayName: string; color: string }) => Promise<void>
  onCancel: () => void
  onSwitchToNew: () => void
}

export function ImportSessionDialog({ onImport, onCancel, onSwitchToNew }: Props): JSX.Element {
  const [sessions, setSessions] = useState<ExternalTmuxSession[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const refresh = () => {
    setSessions(null)
    window.api.listExternalTmux().then((list) => {
      setSessions(list)
      if (list.length === 0) {
        setHelpOpen(true)
      } else {
        if (!selected) {
          setSelected(list[0].name)
          setDisplayName(list[0].name)
        }
      }
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = (name: string) => {
    setSelected(name)
    setDisplayName(name)
  }

  const submit = async () => {
    if (!selected || !displayName.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onImport({
        tmuxName: selected,
        displayName: displayName.trim(),
        color
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog wide-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-tabs">
          <button className="dialog-tab" type="button" onClick={onSwitchToNew}>
            Create new
          </button>
          <button className="dialog-tab active" type="button">Import existing</button>
          <button className="link-btn dialog-tabs-action" onClick={refresh} title="Re-scan tmux">
            ↻ refresh
          </button>
        </div>

        {sessions === null && <div className="empty-state">scanning tmux…</div>}

        {sessions !== null && sessions.length === 0 && (
          <div className="empty-state-banner">
            no tmux sessions found on this mac yet.
          </div>
        )}

        {sessions !== null && sessions.length > 0 && (
          <>
            <div className="field">
              <label>Available sessions</label>
              <div className="external-list">
                {sessions.map((s) => (
                  <div
                    key={s.name}
                    className={`external-row ${selected === s.name ? 'selected' : ''}`}
                    onClick={() => pick(s.name)}
                  >
                    <div className="external-name">{s.name}</div>
                    <div className="external-meta">
                      {s.windows} window{s.windows === 1 ? '' : 's'}
                      {s.attached ? ' · attached' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Display name in sidebar</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Color</label>
              <div className="color-pick">
                {COLORS.map((c) => (
                  <div
                    key={c}
                    className={`color-swatch ${c === color ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <div className="help-toggle">
          <button className="link-btn" onClick={() => setHelpOpen((v) => !v)}>
            {helpOpen ? '▾' : '▸'} how do I create or import an existing claude session?
          </button>
        </div>

        {helpOpen && (
          <div className="inline-help">
            <div className="help-section">
              <h3>A. Start a fresh tmux session in any terminal</h3>
              <p className="help-text">
                Open Terminal.app or iTerm in your project folder and run:
              </p>
              <CodeBlock code="tmux new -s my-project" />
              <p className="help-text">
                You&apos;re now inside tmux. Detach with <kbd>Ctrl-B</kbd> then <kbd>D</kbd>, click
                <strong> ↻ refresh</strong> above, and the session will appear here.
              </p>
            </div>

            <div className="help-section">
              <h3>B. Wrap a Claude window that&apos;s already running</h3>
              <p className="help-text">
                You can&apos;t move a running process into tmux, but Claude saves your chat in{' '}
                <code>~/.claude/projects/</code>, so you can resume it in tmux without losing context.
                Three short steps:
              </p>
              <p className="help-text"><strong>1.</strong> Quit claude (type <code>/exit</code> or press <kbd>Ctrl-C</kbd> twice).</p>
              <p className="help-text"><strong>2.</strong> Start a tmux session:</p>
              <CodeBlock code="tmux new -s myproject" />
              <p className="help-text"><strong>3.</strong> Inside tmux, resume the chat:</p>
              <CodeBlock code="claude -c" />
              <p className="help-text">
                That&apos;s it. Detach with <kbd>Ctrl-B</kbd> then <kbd>D</kbd>, close the Terminal
                window, click <strong>↻ refresh</strong> above, and import.
              </p>
              <p className="help-text" style={{ opacity: 0.7 }}>
                <code>claude -c</code> is the short form of <code>claude --continue</code> — picks the
                most recent chat in the current folder. Use <code>claude --resume</code> for a picker.
              </p>
            </div>

            <div className="help-section">
              <h3>C. After import — how to keep working</h3>
              <p className="help-text">
                Once a session is in PikudClaude, just click it in the sidebar to attach. If claude
                quit inside the session for any reason, type <code>claude -c</code> in the
                shell to bring it back with the same chat history. Your work survives PikudClaude
                restarts because the tmux server runs independently.
              </p>
            </div>
          </div>
        )}

        {error && <div className="error-msg">{error}</div>}

        <div className="dialog-actions">
          <button onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="primary"
            onClick={submit}
            disabled={busy || !selected || !displayName.trim()}
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
