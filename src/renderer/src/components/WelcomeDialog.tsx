import { useState } from 'react'
import { basename } from '../utils/path'

interface Props {
  onDismiss: (projectsRoot: string) => void
}

export function WelcomeDialog({ onDismiss }: Props): JSX.Element {
  const [projectsRoot, setProjectsRoot] = useState<string>('')

  const browse = async (): Promise<void> => {
    const picked = await window.api.pickDirectory()
    if (picked) setProjectsRoot(picked)
  }

  const finish = (): void => {
    onDismiss(projectsRoot.trim())
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog welcome-dialog">
        <div className="welcome-header">
          <div className="welcome-logo">📁</div>
          <h2>Welcome to PikudClaude</h2>
          <p className="welcome-tagline">
            Pick the parent folder where you keep all your code projects —
            we'll use it as the default for new sessions.
          </p>
        </div>

        <div className="welcome-picker">
          <div className="welcome-picker-row">
            <input
              type="text"
              className="settings-input"
              value={projectsRoot}
              onChange={(e) => setProjectsRoot(e.target.value)}
              placeholder="e.g. /Users/you/code"
              autoFocus
            />
            <button type="button" className="primary welcome-browse" onClick={browse}>
              Browse…
            </button>
          </div>
          {projectsRoot && (
            <div className="welcome-picker-preview">
              <span className="welcome-picker-label">Selected:</span>
              <span className="welcome-picker-path" title={projectsRoot}>
                {basename(projectsRoot) || projectsRoot}
              </span>
              <span className="welcome-picker-full">{projectsRoot}</span>
            </div>
          )}
          <p className="settings-hint">
            You can change this later in Settings → Sessions.
          </p>
        </div>

        <div className="welcome-summary">
          <div className="welcome-summary-row">
            <kbd>⌘N</kbd> new session
            <span className="dot">·</span>
            <kbd>⌘1</kbd>–<kbd>⌘9</kbd> jump
            <span className="dot">·</span>
            <kbd>⌘K</kbd> palette
            <span className="dot">·</span>
            <kbd>⌘F</kbd> find
          </div>
          <div className="welcome-summary-row dim">
            Hebrew/RTL · multi-session tmux · awaiting alerts · auto-update
          </div>
        </div>

        <div className="dialog-actions">
          <button onClick={finish}>Skip for now</button>
          <button className="primary" disabled={!projectsRoot.trim()} onClick={finish}>
            Get started
          </button>
        </div>
      </div>
    </div>
  )
}
