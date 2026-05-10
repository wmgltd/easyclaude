import { useEffect, useState, useCallback, useRef } from 'react'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { TerminalView } from './components/TerminalView'
import { NewSessionDialog } from './components/NewSessionDialog'
import { ImportSessionDialog } from './components/ImportSessionDialog'
import { CommandPalette } from './components/CommandPalette'
import type { PaletteAction } from './components/CommandPalette'
import { BookmarksPanel } from './components/BookmarksPanel'
import { SettingsDialog } from './components/SettingsDialog'
import { WelcomeDialog } from './components/WelcomeDialog'
import type { SessionMeta, SessionStatus, Settings } from './types'
import { resolveTheme } from './types'

const DEFAULT_SETTINGS: Settings = {
  notifications: {
    soundEnabled: true,
    soundType: 'chime',
    volume: 0.4,
    systemNotifications: true,
    onlyWhenUnfocused: false,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00'
  },
  sessions: {
    defaultInitialCommand: 'claude',
    defaultCwd: '',
    defaultColor: '#7c3aed',
    autoBookmarkOnAwaiting: false,
    recentProjectsMax: 6,
    preferredIDE: 'cursor'
  },
  appearance: {
    fontSize: 13,
    fontFamily: 'Menlo, "SF Mono", Monaco, "Courier New", "Arial Hebrew", "Lucida Sans Unicode", monospace',
    lineHeight: 1.15,
    cursorStyle: 'block',
    cursorBlink: true,
    theme: 'default',
    customTheme: {
      background: '#000000',
      foreground: '#e4e4ec',
      cursor: '#7c3aed',
      selectionBackground: '#7c3aed55'
    }
  },
  ui: {
    welcomeShown: false
  }
}

function inQuietHours(start: string, end: string, now = new Date()): boolean {
  const parse = (s: string): number => {
    const [h, m] = s.split(':').map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  }
  const cur = now.getHours() * 60 + now.getMinutes()
  const s = parse(start)
  const e = parse(end)
  if (s === e) return false
  if (s < e) return cur >= s && cur < e
  return cur >= s || cur < e
}

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 500
const SIDEBAR_DEFAULT = 240
const SIDEBAR_STORAGE_KEY = 'easyclaude.sidebarWidth'

function loadSidebarWidth(): number {
  const v = Number(localStorage.getItem(SIDEBAR_STORAGE_KEY))
  if (!Number.isFinite(v) || v < SIDEBAR_MIN || v > SIDEBAR_MAX) return SIDEBAR_DEFAULT
  return v
}

let sharedAudioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  if (sharedAudioCtx) {
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => undefined)
    }
    return sharedAudioCtx
  }
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    sharedAudioCtx = new Ctor()
    return sharedAudioCtx
  } catch {
    return null
  }
}

function primeAudio(): void {
  const ctx = getAudioCtx()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => undefined)
}

function playAwaitingSound(volume = 0.4, soundType: 'chime' | 'beep' = 'chime'): void {
  const ctx = getAudioCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined)
  const peak = Math.max(0.001, Math.min(2, volume))
  try {
    const t = ctx.currentTime
    const playTone = (freq: number, start: number, duration: number, type: OscillatorType = 'sine'): void => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration + 0.05)
    }
    if (soundType === 'beep') {
      playTone(1000, t, 0.12, 'square')
    } else {
      playTone(880, t, 0.22)
      playTone(660, t + 0.18, 0.32)
    }
  } catch {
    /* tone failed */
  }
}

export function App(): JSX.Element {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'notifications' | 'sessions' | 'appearance' | 'shortcuts' | 'about'>('notifications')
  const [showPalette, setShowPalette] = useState(false)
  const [paletteMode, setPaletteMode] = useState<'all' | 'sessions'>('all')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [bookmarksRefresh, setBookmarksRefresh] = useState(0)
  const [statuses, setStatuses] = useState<Record<string, SessionStatus>>({})
  const [unseen, setUnseen] = useState<Set<string>>(new Set())
  const [needsAttention, setNeedsAttention] = useState<Set<string>>(new Set())
  const [sidebarWidth, setSidebarWidth] = useState<number>(loadSidebarWidth)
  const draggingRef = useRef(false)
  const prevStatusRef = useRef<Record<string, SessionStatus>>({})
  const activeIdRef = useRef<string | null>(null)
  const sessionsRef = useRef<SessionMeta[]>([])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  const refresh = useCallback(async () => {
    const list = await window.api.listSessions()
    setSessions(list)
    if (list.length > 0 && !list.find((s) => s.id === activeId)) {
      setActiveId(list[0].id)
    }
    if (list.length === 0) setActiveId(null)
    const initial = await window.api.getStatuses()
    setStatuses(initial)
    prevStatusRef.current = initial
  }, [activeId])

  useEffect(() => {
    refresh()
    window.api
      .getSettings()
      .then((s) => {
        setSettings(s)
        settingsRef.current = s
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    return window.api.onNotificationClick((id) => setActiveId(id))
  }, [])

  useEffect(() => {
    return window.api.onMenuAction((action) => {
      switch (action) {
        case 'new-session':
          setShowNewDialog(true)
          break
        case 'import-session':
          setShowImportDialog(true)
          break
        case 'settings':
          setShowSettings(true)
          break
        case 'palette-all':
          setPaletteMode('all')
          setShowPalette(true)
          break
        case 'palette-sessions':
          setPaletteMode('sessions')
          setShowPalette(true)
          break
        case 'toggle-bookmarks':
          setShowBookmarks((v) => !v)
          break
        case 'help':
          setSettingsInitialTab('shortcuts')
          setShowSettings(true)
          break
        case 'bookmark': {
          const id = activeIdRef.current
          if (!id) break
          const label = `Bookmark ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
          window.api.createBookmark(id, label).then(() => {
            setBookmarksRefresh((n) => n + 1)
            setShowBookmarks(true)
          })
          break
        }
        case 'search': {
          /* dispatch to active TerminalView via synthetic keydown */
          const ev = new KeyboardEvent('keydown', {
            key: 'f',
            metaKey: true,
            bubbles: true
          })
          window.dispatchEvent(ev)
          break
        }
      }
    })
  }, [])

  useEffect(() => {
    const onFirstGesture = (): void => {
      primeAudio()
      window.removeEventListener('mousedown', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
    }
    window.addEventListener('mousedown', onFirstGesture, { once: true })
    window.addEventListener('keydown', onFirstGesture, { once: true })
    return () => {
      window.removeEventListener('mousedown', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
    }
  }, [])

  useEffect(() => {
    return window.api.onSessionExit((id) => {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      setActiveId((prev) => (prev === id ? null : prev))
    })
  }, [])

  useEffect(() => {
    return window.api.onSessionStatus((id, status) => {
      setStatuses((prev) => {
        const prevStatus = prev[id]
        const next = { ...prev, [id]: status }
        const isActive = id === activeIdRef.current
        if (!isActive) {
          if (prevStatus === 'working' && status === 'idle') {
            setUnseen((u) => new Set(u).add(id))
          }
          if (status === 'awaiting' && prevStatus !== 'awaiting') {
            setNeedsAttention((u) => new Set(u).add(id))
            const s = settingsRef.current
            const focused = document.hasFocus()
            const quiet = s.notifications.quietHoursEnabled
              && inQuietHours(s.notifications.quietHoursStart, s.notifications.quietHoursEnd)
            const suppress = quiet || (s.notifications.onlyWhenUnfocused && focused)
            if (!suppress && s.notifications.soundEnabled) {
              playAwaitingSound(s.notifications.volume, s.notifications.soundType)
            }
            const session = sessionsRef.current.find((sess) => sess.id === id)
            if (!suppress && s.notifications.systemNotifications) {
              window.api.notifyAwaiting(id, session?.name ?? 'session').catch(() => undefined)
            }
            if (s.sessions.autoBookmarkOnAwaiting && session) {
              const label = `auto: awaiting ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
              window.api.createBookmark(id, label).then(() => {
                setBookmarksRefresh((n) => n + 1)
              }).catch(() => undefined)
            }
          }
        }
        prevStatusRef.current = next
        return next
      })
    })
  }, [])

  useEffect(() => {
    if (!activeId) return
    setUnseen((u) => {
      if (!u.has(activeId)) return u
      const next = new Set(u)
      next.delete(activeId)
      return next
    })
    setNeedsAttention((u) => {
      if (!u.has(activeId)) return u
      const next = new Set(u)
      next.delete(activeId)
      return next
    })
  }, [activeId])

  useEffect(() => {
    const modalOpen = showNewDialog || showImportDialog || showPalette || showSettings
    if (modalOpen && !showPalette) return
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey || e.ctrlKey || e.altKey) return

      if (!e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteMode('all')
        setShowPalette((v) => !v)
        return
      }
      if (!e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPaletteMode('sessions')
        setShowPalette((v) => !v)
        return
      }
      if (!e.shiftKey && e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
        return
      }
      if (modalOpen) return
      if (!e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        const id = activeIdRef.current
        if (!id) return
        const label = `Bookmark ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
        window.api.createBookmark(id, label).then(() => {
          setBookmarksRefresh((n) => n + 1)
          setShowBookmarks(true)
        })
        return
      }
      if (!e.shiftKey) {
        const n = Number(e.key)
        if (Number.isInteger(n) && n >= 1 && n <= 9) {
          const target = sessions[n - 1]
          if (target) {
            e.preventDefault()
            setActiveId(target.id)
          }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sessions, showNewDialog, showImportDialog, showPalette, showSettings])

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      const w = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, ev.clientX))
      setSidebarWidth(w)
    }
    const onUp = () => {
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setSidebarWidth((current) => {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(current))
        return current
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleCreate = async (opts: {
    name: string
    cwd: string
    color: string
    initialCommand: string
  }) => {
    const meta = await window.api.createSession({
      name: opts.name,
      cwd: opts.cwd,
      color: opts.color,
      initialCommand: opts.initialCommand || undefined
    })
    setSessions((prev) => [meta, ...prev])
    setActiveId(meta.id)
    setShowNewDialog(false)
  }

  const handleImport = async (opts: {
    tmuxName: string
    displayName: string
    color: string
  }) => {
    const meta = await window.api.importSession(opts)
    setSessions((prev) => [meta, ...prev])
    setActiveId(meta.id)
    setShowImportDialog(false)
  }

  const handleDelete = async (id: string) => {
    await window.api.killSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    setActiveId((prev) => (prev === id ? null : prev))
  }

  const handleRename = async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    await window.api.renameSession(id, trimmed)
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)))
  }

  const handleSetColor = async (id: string, color: string): Promise<void> => {
    await window.api.setSessionColor(id, color)
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)))
  }

  const handleReorder = async (orderedIds: string[]): Promise<void> => {
    setSessions((prev) => {
      const indexOf = new Map(orderedIds.map((id, i) => [id, i]))
      return [...prev].sort((a, b) => (indexOf.get(a.id) ?? 9999) - (indexOf.get(b.id) ?? 9999))
    })
    await window.api.reorderSessions(orderedIds)
  }

  const paletteActions: PaletteAction[] = [
    { id: 'new', label: 'New session', hint: '⌘+', run: () => setShowNewDialog(true) },
    { id: 'import', label: 'Import existing tmux session', hint: '⌘⤓', run: () => setShowImportDialog(true) },
    { id: 'help', label: 'Keyboard shortcuts', hint: '', run: () => {
      setSettingsInitialTab('shortcuts')
      setShowSettings(true)
    } },
    { id: 'settings', label: 'Settings', hint: '⌘,', run: () => setShowSettings(true) },
    { id: 'bookmark', label: 'Bookmark current point', hint: '⌘B', run: () => {
      const id = activeIdRef.current
      if (!id) return
      const label = `Bookmark ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      window.api.createBookmark(id, label).then(() => {
        setBookmarksRefresh((n) => n + 1)
        setShowBookmarks(true)
      })
    }},
    { id: 'toggle-bookmarks', label: showBookmarks ? 'Hide bookmarks panel' : 'Show bookmarks panel', run: () => setShowBookmarks((v) => !v) }
  ]

  const gridCols = showBookmarks
    ? `${sidebarWidth}px 4px 1fr 240px`
    : `${sidebarWidth}px 4px 1fr`

  const activeSession = sessions.find((s) => s.id === activeId) ?? null

  return (
    <div className="app-shell">
      <TopBar session={activeSession} />
      <div className="app" style={{ gridTemplateColumns: gridCols }}>
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        statuses={statuses}
        unseen={unseen}
        needsAttention={needsAttention}
        onSelect={setActiveId}
        onNew={() => setShowNewDialog(true)}
        onImport={() => setShowImportDialog(true)}
        onHelp={() => {
          setSettingsInitialTab('shortcuts')
          setShowSettings(true)
        }}
        onTogglePalette={() => {
          setPaletteMode('all')
          setShowPalette((v) => !v)
        }}
        onToggleBookmarks={() => setShowBookmarks((v) => !v)}
        onSettings={() => setShowSettings(true)}
        bookmarksOpen={showBookmarks}
        onDelete={handleDelete}
        onRename={handleRename}
        onSetColor={handleSetColor}
        onReorder={handleReorder}
      />
      <div className="resizer" onMouseDown={startDrag} />
      <div
        className="terminal-area"
        style={{ background: resolveTheme(settings.appearance).background }}
      >
        {sessions.length === 0 && (
          <div className="terminal-empty">
            no sessions yet — hit <kbd>+</kbd> in the sidebar to start one
          </div>
        )}
        {sessions.map((s) => (
          <TerminalView
            key={s.id}
            session={s}
            active={s.id === activeId}
            fontSize={settings.appearance.fontSize}
            fontFamily={settings.appearance.fontFamily}
            lineHeight={settings.appearance.lineHeight}
            cursorStyle={settings.appearance.cursorStyle}
            cursorBlink={settings.appearance.cursorBlink}
            theme={resolveTheme(settings.appearance)}
            preferredIDE={settings.sessions.preferredIDE}
          />
        ))}
      </div>
      {showBookmarks && (
        <BookmarksPanel
          sessionId={activeId}
          refreshKey={bookmarksRefresh}
          onClose={() => setShowBookmarks(false)}
        />
      )}
      {showNewDialog && (
        <NewSessionDialog
          onCreate={handleCreate}
          onCancel={() => setShowNewDialog(false)}
          onSwitchToImport={() => {
            setShowNewDialog(false)
            setShowImportDialog(true)
          }}
          defaultInitialCommand={settings.sessions.defaultInitialCommand}
          defaultCwd={settings.sessions.defaultCwd}
          defaultColor={settings.sessions.defaultColor}
          recentMax={settings.sessions.recentProjectsMax}
        />
      )}
      {showSettings && (
        <SettingsDialog
          initial={settings}
          initialTab={settingsInitialTab}
          onSave={async (next) => {
            const saved = await window.api.saveSettings(next)
            setSettings(saved)
            settingsRef.current = saved
            setShowSettings(false)
            setSettingsInitialTab('notifications')
          }}
          onCancel={() => {
            setShowSettings(false)
            setSettingsInitialTab('notifications')
          }}
          onTestSound={(v, t) => playAwaitingSound(v, t)}
        />
      )}
      {showImportDialog && (
        <ImportSessionDialog
          onImport={handleImport}
          onCancel={() => setShowImportDialog(false)}
          onSwitchToNew={() => {
            setShowImportDialog(false)
            setShowNewDialog(true)
          }}
        />
      )}
      {showPalette && (
        <CommandPalette
          sessions={sessions}
          activeId={activeId}
          actions={paletteActions}
          onClose={() => setShowPalette(false)}
          onSelectSession={setActiveId}
          mode={paletteMode}
        />
      )}
      {!settings.ui.welcomeShown && (
        <WelcomeDialog
          onDismiss={async () => {
            const saved = await window.api.saveSettings({ ui: { welcomeShown: true } })
            setSettings(saved)
            settingsRef.current = saved
          }}
        />
      )}
      </div>
    </div>
  )
}
