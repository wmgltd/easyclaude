import { useEffect, useState } from 'react'
import type { SessionMeta } from '../types'
import { basename } from '../utils/path'

interface Props {
  session: SessionMeta | null
}

export function TopBar({ session }: Props): JSX.Element {
  const [branch, setBranch] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.cwd) {
      setBranch(null)
      return
    }
    let cancelled = false
    window.api
      .getGitBranch(session.cwd)
      .then((b) => {
        if (!cancelled) setBranch(b)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [session?.id, session?.cwd])

  if (!session) {
    return <div className="top-bar empty">PikudClaude</div>
  }
  const dir = basename(session.cwd) || session.cwd

  return (
    <div className="top-bar">
      <span className="top-bar-name" style={{ borderColor: session.color }}>
        {session.name}
      </span>
      <span className="top-bar-sep">·</span>
      <span className="top-bar-cwd" title={session.cwd}>{dir}</span>
      {branch && (
        <>
          <span className="top-bar-sep">·</span>
          <span className="top-bar-branch">⎇ {branch}</span>
        </>
      )}
    </div>
  )
}
