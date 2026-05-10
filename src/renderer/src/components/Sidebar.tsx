import { useState, useEffect, useRef } from 'react'
import type { SessionMeta, SessionStatus } from '../types'
import { basename } from '../utils/path'

const SESSION_COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']

interface Props {
  sessions: SessionMeta[]
  activeId: string | null
  statuses: Record<string, SessionStatus>
  unseen: Set<string>
  needsAttention: Set<string>
  bookmarksOpen: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onImport: () => void
  onHelp: () => void
  onTogglePalette: () => void
  onToggleBookmarks: () => void
  onSettings: () => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onSetColor: (id: string, color: string) => void
  onReorder: (orderedIds: string[]) => void
}

export function Sidebar({
  sessions,
  activeId,
  statuses,
  unseen,
  needsAttention,
  bookmarksOpen,
  onSelect,
  onNew,
  onHelp,
  onTogglePalette,
  onToggleBookmarks,
  onSettings,
  onDelete,
  onRename,
  onSetColor,
  onReorder
}: Props): JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null)
  const [usage, setUsage] = useState<{
    totalTokens: number
    costUSD: number
    msUntilReset: number
    percentUsed: number | null
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    const fetchUsage = (): void => {
      window.api
        .getActiveBlock()
        .then((b) => {
          if (mounted) setUsage(b)
        })
        .catch(() => undefined)
    }
    fetchUsage()
    const interval = setInterval(fetchUsage, 10 * 60 * 1000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    if (!colorPickerId) return
    const close = (): void => setColorPickerId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [colorPickerId])

  const startEdit = (s: SessionMeta): void => {
    setEditingId(s.id)
    setEditValue(s.name)
  }

  const commitEdit = (): void => {
    if (editingId) onRename(editingId, editValue)
    setEditingId(null)
  }

  const cancelEdit = (): void => {
    setEditingId(null)
  }

  const handleDragStart = (e: React.DragEvent, id: string): void => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, id: string): void => {
    if (!draggingId || draggingId === id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDropTargetId(id)
    setDropPosition(e.clientY < midY ? 'above' : 'below')
  }

  const handleDragEnd = (): void => {
    setDraggingId(null)
    setDropTargetId(null)
    setDropPosition(null)
  }

  const handleDrop = (e: React.DragEvent, targetId: string): void => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain') || draggingId
    if (!draggedId || draggedId === targetId) {
      handleDragEnd()
      return
    }
    const ordered = sessions.map((s) => s.id).filter((id) => id !== draggedId)
    let targetIndex = ordered.indexOf(targetId)
    if (dropPosition === 'below') targetIndex++
    ordered.splice(targetIndex, 0, draggedId)
    onReorder(ordered)
    handleDragEnd()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">EasyClaude <span className="sidebar-title-by">by WMG</span></div>
        <div className="sidebar-buttons">
          <button className="add-btn" onClick={onTogglePalette} title="Command palette (⌘K)">⌘K</button>
          <button
            className={`add-btn ${bookmarksOpen ? 'on' : ''}`}
            onClick={onToggleBookmarks}
            title="Toggle bookmarks (⌘B to add)"
          >★</button>
          <button className="add-btn" onClick={onSettings} title="Settings (⌘,)">⚙</button>
          <button className="add-btn" onClick={onNew} title="New session (also: import existing)">+</button>
        </div>
      </div>
      <div className="sidebar-list">
        {sessions.length === 0 && (
          <div className="empty-state">
            no sessions.<br />
            click <strong>+</strong> to create or import a tmux session.
          </div>
        )}
        {sessions.map((s, i) => {
          const status = statuses[s.id] ?? 'detached'
          const isEditing = editingId === s.id
          const isUnseen = unseen.has(s.id)
          const needsAttn = needsAttention.has(s.id)
          const isDragging = draggingId === s.id
          const isDropTarget = dropTargetId === s.id
          return (
            <div
              key={s.id}
              draggable={!isEditing}
              onDragStart={(e) => handleDragStart(e, s.id)}
              onDragOver={(e) => handleDragOver(e, s.id)}
              onDrop={(e) => handleDrop(e, s.id)}
              onDragEnd={handleDragEnd}
              onDragLeave={() => {
                if (dropTargetId === s.id) {
                  setDropTargetId(null)
                  setDropPosition(null)
                }
              }}
              className={`session-row ${activeId === s.id ? 'active' : ''} ${needsAttn ? 'needs-attn' : ''} ${isUnseen ? 'unseen' : ''} ${isDragging ? 'dragging' : ''} ${isDropTarget && dropPosition ? `drop-${dropPosition}` : ''}`}
              onClick={() => !isEditing && onSelect(s.id)}
            >
              <div
                className={`session-dot ${status === 'shell' || status === 'detached' ? 'inactive' : ''}`}
                style={{ background: status === 'shell' || status === 'detached' ? '#3b3b46' : s.color }}
                title={status === 'shell' ? 'Claude not running — click to change color' : 'Click to change color'}
                onClick={(e) => {
                  e.stopPropagation()
                  setColorPickerId(colorPickerId === s.id ? null : s.id)
                }}
              />
              {colorPickerId === s.id && (
                <div className="session-color-picker" onClick={(e) => e.stopPropagation()}>
                  {SESSION_COLORS.map((c) => (
                    <div
                      key={c}
                      className={`color-swatch ${c === s.color ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => {
                        onSetColor(s.id, c)
                        setColorPickerId(null)
                      }}
                    />
                  ))}
                </div>
              )}
              <div className="session-info">
                <div className="session-name-row">
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      className="rename-input"
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitEdit()
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          cancelEdit()
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="session-name"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        startEdit(s)
                      }}
                      title="Double-click to rename"
                    >
                      {s.name}
                    </span>
                  )}
                  {s.imported && !isEditing && (
                    <span className="imported-badge" title={`imported from tmux: ${s.tmuxName}`}>↥</span>
                  )}
                </div>
                <div className="session-cwd">{basename(s.cwd) || s.tmuxName}</div>
              </div>
              <div className={`status-icon ${status}`} title={statusLabel(status)} />
              {(isUnseen || needsAttn) && (
                <div
                  className={`attn-dot ${needsAttn ? 'urgent' : ''}`}
                  title={needsAttn ? 'awaiting your input' : 'finished while you were away'}
                />
              )}
              {i < 9 && (
                <div className="session-shortcut" title={`Cmd+${i + 1}`}>⌘{i + 1}</div>
              )}
              <div className="session-actions">
                <button
                  className="icon-btn danger"
                  title={s.imported ? 'Remove from sidebar (keeps tmux session alive)' : 'Kill session'}
                  onClick={(e) => {
                    e.stopPropagation()
                    const msg = s.imported
                      ? `Remove "${s.name}" from sidebar?\n\nThe tmux session "${s.tmuxName}" will keep running — you can re-import it later.`
                      : `Kill session "${s.name}"?`
                    if (confirm(msg)) onDelete(s.id)
                  }}
                >
                  {s.imported ? '⊖' : '🗑'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div
        className="sidebar-footer"
        title={
          usage
            ? `5-hour block · ${formatTokens(usage.totalTokens)} tokens · resets in ${formatDuration(usage.msUntilReset)}${usage.percentUsed != null ? ` · ${usage.percentUsed.toFixed(1)}% of historical max` : ''}`
            : 'no active 5-hour usage block'
        }
      >
        {usage ? (
          <>
            <div className="usage-row">
              <span className="usage-pct">
                {usage.percentUsed != null ? `${Math.round(usage.percentUsed)}%` : '—'}
              </span>
              <span className="usage-reset">↻ {formatDuration(usage.msUntilReset)}</span>
            </div>
            <div className="usage-bar">
              <div
                className="usage-bar-fill"
                style={{ width: `${Math.min(100, usage.percentUsed ?? 0)}%` }}
              />
            </div>
            <div className="usage-row usage-sub">
              <span className="usage-tokens">{formatTokens(usage.totalTokens)} tok</span>
            </div>
          </>
        ) : (
          <span className="usage-empty">no active usage</span>
        )}
      </div>
    </aside>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function statusLabel(status: SessionStatus): string {
  switch (status) {
    case 'working': return 'claude is working…'
    case 'idle': return 'idle — waiting for you'
    case 'awaiting': return 'awaiting your decision (1 / 2 / 3)'
    case 'detached': return 'not attached'
    case 'shell': return 'shell only — claude not running'
  }
}
