import { CodeBlock } from './CodeBlock'

interface Props {
  onClose: () => void
}

export function HelpDialog({ onClose }: Props): JSX.Element {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog help-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>How to bring sessions into PikudClaude</h2>

        <section className="help-section">
          <h3>1. Start a fresh session</h3>
          <p className="help-text">
            Click <strong>+</strong> in the sidebar. Pick a name, browse to the project folder,
            and PikudClaude will launch <code>claude</code> in a new tmux session for you.
          </p>
        </section>

        <section className="help-section">
          <h3>2. Import an existing tmux session</h3>
          <p className="help-text">
            If you already have a tmux session running anywhere on your mac, click <strong>⤓</strong> in
            the sidebar — it lists every tmux session that isn&apos;t already in PikudClaude. Pick one,
            give it a display name, and it shows up alongside the rest.
          </p>
          <p className="help-text">
            Don&apos;t have a tmux session yet? Open any Terminal.app or iTerm window in your project
            folder and run:
          </p>
          <CodeBlock code="tmux new -s my-project" />
          <p className="help-text">
            Then either start working inside it, or detach with <kbd>Ctrl-B</kbd> then <kbd>D</kbd>
            and import it from PikudClaude.
          </p>
        </section>

        <section className="help-section">
          <h3>3. Wrap a Claude window that&apos;s already running</h3>
          <p className="help-text">
            macOS doesn&apos;t allow embedding another app&apos;s window into PikudClaude. But the
            chat history is saved in <code>~/.claude/projects/</code>, so you can resume it inside a
            tmux session without losing context.
          </p>
          <p className="help-text"><strong>Step 1.</strong> Quit claude in the existing window — type <code>/exit</code> or press <kbd>Ctrl-C</kbd> twice.</p>
          <p className="help-text"><strong>Step 2.</strong> Start a tmux session:</p>
          <CodeBlock code="tmux new -s myproject" />
          <p className="help-text"><strong>Step 3.</strong> Inside tmux, bring the chat back:</p>
          <CodeBlock code="claude -c" />
          <p className="help-text">
            <strong>Step 4.</strong> Detach with <kbd>Ctrl-B</kbd> then <kbd>D</kbd>. The tmux
            session keeps running in the background — close the Terminal window safely.
          </p>
          <p className="help-text">
            <strong>Step 5.</strong> In PikudClaude, click <strong>⤓</strong> and import it.
          </p>
          <p className="help-text" style={{ opacity: 0.7 }}>
            <code>claude -c</code> is short for <code>claude --continue</code> — picks the most
            recent chat in the current folder. Use <code>claude --resume</code> for a picker of all
            recent chats in this folder.
          </p>
        </section>

        <section className="help-section">
          <h3>4. Useful keyboard shortcuts</h3>
          <ul className="help-list">
            <li><kbd>⌘1</kbd> – <kbd>⌘9</kbd> — jump to session 1-9</li>
            <li>Double-click a session name in the sidebar to rename it</li>
            <li>Drag the sidebar&apos;s right edge to resize</li>
          </ul>
        </section>

        <div className="dialog-actions">
          <button className="primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}

