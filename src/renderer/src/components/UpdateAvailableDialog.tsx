import { useState } from 'react'

interface Props {
  version: string
  state: 'downloading' | 'ready'
  progressPercent?: number
  onUpdateNow: () => Promise<void>
  onSkip: () => void
}

export function UpdateAvailableDialog({
  version,
  state,
  progressPercent,
  onUpdateNow,
  onSkip
}: Props): JSX.Element {
  const [installing, setInstalling] = useState(false)

  const handleUpdate = async (): Promise<void> => {
    setInstalling(true)
    try {
      await onUpdateNow()
    } catch {
      setInstalling(false)
    }
  }

  const headline =
    state === 'ready'
      ? `Version ${version} is ready to install`
      : `Version ${version} is downloading…`

  const body =
    state === 'ready'
      ? 'PikudClaude will quit and relaunch on the new version. Your tmux sessions stay alive in the background, so you can pick up where you left off.'
      : 'The update is downloading in the background. Click Update now when ready, or Skip and it will install on next quit.'

  const updateBtnLabel = installing
    ? 'Installing…'
    : state === 'ready'
      ? 'Update now'
      : `Downloading… ${progressPercent !== undefined ? `${Math.round(progressPercent)}%` : ''}`

  const updateBtnDisabled = state !== 'ready' || installing

  return (
    <div className="dialog-backdrop">
      <div className="dialog update-available-dialog">
        <h2>Update available</h2>
        <p className="update-headline">{headline}</p>
        <p className="update-body">{body}</p>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onSkip} disabled={installing}>
            Skip
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleUpdate}
            disabled={updateBtnDisabled}
          >
            {updateBtnLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
