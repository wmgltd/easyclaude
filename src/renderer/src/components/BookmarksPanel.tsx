import { useEffect, useState } from 'react'
import type { Bookmark } from '../types'

interface Props {
  sessionId: string | null
  refreshKey: number
  onClose: () => void
}

export function BookmarksPanel({ sessionId, refreshKey, onClose }: Props): JSX.Element | null {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [viewing, setViewing] = useState<Bookmark | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setBookmarks([])
      return
    }
    window.api.listBookmarks(sessionId).then(setBookmarks)
  }, [sessionId, refreshKey])

  if (!sessionId) return null

  const remove = async (id: string) => {
    await window.api.deleteBookmark(id)
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
    if (viewing?.id === id) setViewing(null)
  }

  return (
    <>
      <aside className="bookmarks-panel">
        <div className="bookmarks-header">
          <span>Bookmarks</span>
          <button className="icon-btn" onClick={onClose} title="Close">×</button>
        </div>
        <div className="bookmarks-list">
          {bookmarks.length === 0 && (
            <div className="empty-state">
              no bookmarks yet.<br />
              press <kbd>⌘B</kbd> to mark this point.
            </div>
          )}
          {bookmarks.map((b) => (
            <div key={b.id} className="bookmark-row" onClick={() => setViewing(b)}>
              <div className="bookmark-info">
                <div className="bookmark-label">{b.label}</div>
                <div className="bookmark-time">{formatTime(b.createdAt)}</div>
              </div>
              <button
                className="icon-btn danger"
                title="Delete bookmark"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(b.id)
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>
      {viewing && (
        <div className="dialog-backdrop" onClick={() => setViewing(null)}>
          <div className="dialog snapshot-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{viewing.label}</h2>
            <div className="snapshot-time">{formatTime(viewing.createdAt)}</div>
            <pre className="snapshot-content">{viewing.snapshot || '(no snapshot captured)'}</pre>
            <div className="dialog-actions">
              <button className="primary" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
