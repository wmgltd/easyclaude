interface Props {
  onDismiss: () => void
}

export function WelcomeDialog({ onDismiss }: Props): JSX.Element {
  return (
    <div className="dialog-backdrop">
      <div className="dialog welcome-dialog">
        <div className="welcome-header">
          <div className="welcome-logo">⌘</div>
          <h2>Welcome to EasyClaude</h2>
          <p className="welcome-tagline">Multi-session terminal hub for Claude Code, backed by tmux.</p>
        </div>

        <div className="welcome-features">
          <div className="welcome-feature">
            <div className="welcome-icon">⌘K</div>
            <div className="welcome-feature-body">
              <h4>Command palette</h4>
              <p>Jump to any session or run an action. <kbd>⌘P</kbd> filters to sessions only.</p>
            </div>
          </div>
          <div className="welcome-feature">
            <div className="welcome-icon">↓</div>
            <div className="welcome-feature-body">
              <h4>Drag-drop sessions</h4>
              <p>Reorder sessions in the sidebar by dragging. Click the colored dot to recolor.</p>
            </div>
          </div>
          <div className="welcome-feature">
            <div className="welcome-icon">★</div>
            <div className="welcome-feature-body">
              <h4>Hebrew, Arabic, RTL</h4>
              <p>EasyClaude renders right-to-left scripts correctly — a feature missing from VSCode, Cursor, Hyper, and other xterm.js terminals.</p>
            </div>
          </div>
          <div className="welcome-feature">
            <div className="welcome-icon">🔔</div>
            <div className="welcome-feature-body">
              <h4>Awaiting alerts</h4>
              <p>Chime + macOS notification when Claude needs your input on a non-active session. Configurable in <kbd>⌘,</kbd>.</p>
            </div>
          </div>
        </div>

        <div className="welcome-shortcuts">
          <strong>Quick shortcuts:</strong>
          <span><kbd>⌘N</kbd> new session</span>
          <span><kbd>⌘1</kbd>–<kbd>⌘9</kbd> jump</span>
          <span><kbd>⌘F</kbd> find</span>
          <span><kbd>⌘B</kbd> bookmark</span>
        </div>

        <div className="dialog-actions">
          <button className="primary" onClick={onDismiss}>
            Get started
          </button>
        </div>
      </div>
    </div>
  )
}
