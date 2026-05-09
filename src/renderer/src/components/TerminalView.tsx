import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { ClipboardAddon } from '@xterm/addon-clipboard'
import type { SessionMeta, ThemeColors, CursorStyle } from '../types'

interface Props {
  session: SessionMeta
  active: boolean
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  cursorStyle?: CursorStyle
  cursorBlink?: boolean
  theme?: ThemeColors
  preferredIDE?: 'cursor' | 'vscode' | 'finder'
}

const DEFAULT_FONT_FAMILY =
  'Menlo, "SF Mono", Monaco, "Courier New", "Arial Hebrew", "Lucida Sans Unicode", monospace'

const DEFAULT_THEME: ThemeColors = {
  background: '#000000',
  foreground: '#e4e4ec',
  cursor: '#7c3aed',
  selectionBackground: '#7c3aed55'
}

export function TerminalView({
  session,
  active,
  fontSize = 13,
  fontFamily = DEFAULT_FONT_FAMILY,
  lineHeight = 1.15,
  cursorStyle = 'block',
  cursorBlink = true,
  theme = DEFAULT_THEME,
  preferredIDE = 'cursor'
}: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const savedScrollLineRef = useRef<number | null>(null)
  const bidiObserverRef = useRef<MutationObserver | null>(null)
  const preferredIDERef = useRef(preferredIDE)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    preferredIDERef.current = preferredIDE
  }, [preferredIDE])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      fontFamily,
      fontSize,
      lineHeight,
      cursorBlink,
      cursorStyle,
      theme: {
        background: theme.background,
        foreground: theme.foreground,
        cursor: theme.cursor,
        selectionBackground: theme.selectionBackground
      },
      allowProposedApi: true,
      scrollback: 10000
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(new ClipboardAddon())
    term.loadAddon(search)
    term.open(host)

    term.attachCustomKeyEventHandler((ev) => {
      if (ev.type === 'keydown' && ev.key === 'Enter' && ev.shiftKey && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        window.api.writeSession(session.id, '\x1b\r')
        return false
      }
      return true
    })

    term.registerLinkProvider({
      provideLinks: (lineNumber, callback) => {
        const buffer = term.buffer.active
        const line = buffer.getLine(lineNumber - 1)
        if (!line) {
          callback(undefined)
          return
        }
        const text = line.translateToString(true)
        const links: Array<{
          range: { start: { x: number; y: number }; end: { x: number; y: number } }
          text: string
          activate: () => void
        }> = []
        const re = /([\w./~-]*[\w-][\w/-]*\.[a-zA-Z][a-zA-Z0-9]{0,7}):(\d+)(?::(\d+))?/g
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null) {
          const [match, path, lineStr, colStr] = m
          const startCol = m.index + 1
          const endCol = m.index + match.length
          links.push({
            range: { start: { x: startCol, y: lineNumber }, end: { x: endCol, y: lineNumber } },
            text: match,
            activate: () => {
              window.api
                .openFile({
                  path,
                  line: Number(lineStr) || undefined,
                  col: colStr ? Number(colStr) : undefined,
                  cwd: session.cwd,
                  ide: preferredIDERef.current
                })
                .catch(() => undefined)
            }
          })
        }
        callback(links.length ? (links as never) : undefined)
      }
    })

    termRef.current = term
    fitRef.current = fit
    searchRef.current = search
    bidiObserverRef.current = setupBidiObserver(host)

    const init = async () => {
      requestAnimationFrame(() => {
        try {
          fit.fit()
        } catch {
          /* noop */
        }
      })
      const dims = fit.proposeDimensions() ?? { cols: 100, rows: 30 }
      await window.api.attachSession(session.id, dims.cols, dims.rows)
      unsubRef.current = window.api.onSessionData((id, data) => {
        if (id === session.id) term.write(data)
      })
      term.onData((data) => {
        window.api.writeSession(session.id, data)
      })
      term.onResize(({ cols, rows }) => {
        window.api.resizeSession(session.id, cols, rows)
      })
    }
    init()

    return () => {
      unsubRef.current?.()
      bidiObserverRef.current?.disconnect()
      bidiObserverRef.current = null
      term.dispose()
      termRef.current = null
      fitRef.current = null
      searchRef.current = null
    }
  }, [session.id])

  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active])

  useEffect(() => {
    const term = termRef.current
    const fit = fitRef.current
    if (!term || !fit) return
    term.options.fontSize = fontSize
    term.options.fontFamily = fontFamily
    term.options.lineHeight = lineHeight
    term.options.cursorStyle = cursorStyle
    term.options.cursorBlink = cursorBlink
    term.options.theme = {
      background: theme.background,
      foreground: theme.foreground,
      cursor: theme.cursor,
      selectionBackground: theme.selectionBackground
    }
    requestAnimationFrame(() => {
      try {
        fit.fit()
      } catch {
        /* noop */
      }
    })
  }, [
    fontSize,
    fontFamily,
    lineHeight,
    cursorStyle,
    cursorBlink,
    theme.background,
    theme.foreground,
    theme.cursor,
    theme.selectionBackground
  ])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    if (active) {
      const fit = fitRef.current
      const onResize = (): void => {
        try {
          fit?.fit()
        } catch {
          /* noop */
        }
      }
      requestAnimationFrame(() => {
        onResize()
        if (savedScrollLineRef.current !== null) {
          try {
            term.scrollToLine(savedScrollLineRef.current)
          } catch {
            /* noop */
          }
          savedScrollLineRef.current = null
        }
      })
      window.addEventListener('resize', onResize)
      term.focus()
      return () => window.removeEventListener('resize', onResize)
    }
    try {
      const buffer = term.buffer.active
      const total = buffer.length
      const viewportY = buffer.viewportY
      const atBottom = viewportY >= Math.max(0, total - term.rows)
      savedScrollLineRef.current = atBottom ? null : viewportY
    } catch {
      savedScrollLineRef.current = null
    }
    return undefined
  }, [active])

  useEffect(() => {
    if (!active) return

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }

    const onDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      e.preventDefault()
      const paths: string[] = []
      for (const f of Array.from(files)) {
        const p = window.api.getPathForFile(f)
        if (p) paths.push(quotePath(p))
      }
      if (paths.length === 0) return
      window.api.writeSession(session.id, paths.join(' '))
      termRef.current?.focus()
    }

    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [active, session.id])

  const closeSearch = (): void => {
    setSearchOpen(false)
    setSearchQuery('')
    searchRef.current?.clearDecorations()
    requestAnimationFrame(() => termRef.current?.focus())
  }

  const runSearch = (forward: boolean): void => {
    const q = searchQuery
    if (!q || !searchRef.current) return
    const opts = {
      decorations: {
        matchBackground: '#7c3aed55',
        matchBorder: '#7c3aed',
        matchOverviewRuler: '#7c3aed',
        activeMatchBackground: '#7c3aedaa',
        activeMatchBorder: '#a78bfa',
        activeMatchColorOverviewRuler: '#a78bfa'
      }
    }
    if (forward) searchRef.current.findNext(q, opts)
    else searchRef.current.findPrevious(q, opts)
  }

  return (
    <div className={`terminal-wrap ${active ? '' : 'hidden'}`}>
      <div ref={hostRef} className="terminal-host" />
      {searchOpen && (
        <div className="terminal-search">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Find…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (e.target.value) {
                requestAnimationFrame(() => {
                  searchRef.current?.findNext(e.target.value)
                })
              } else {
                searchRef.current?.clearDecorations()
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                closeSearch()
              } else if (e.key === 'Enter') {
                e.preventDefault()
                runSearch(!e.shiftKey)
              }
            }}
          />
          <button
            type="button"
            className="terminal-search-btn"
            title="Previous (⇧⏎)"
            onClick={() => runSearch(false)}
          >
            ↑
          </button>
          <button
            type="button"
            className="terminal-search-btn"
            title="Next (⏎)"
            onClick={() => runSearch(true)}
          >
            ↓
          </button>
          <button
            type="button"
            className="terminal-search-btn"
            title="Close (Esc)"
            onClick={closeSearch}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

function quotePath(p: string): string {
  if (!/[\s"'\\$`!*?(){}[\]<>|&;#]/.test(p)) return p
  return `'${p.replace(/'/g, `'\\''`)}'`
}

const HEBREW_CHAR_RE = /[֐-׿יִ-ﭏ]/

function setupBidiObserver(host: HTMLElement): MutationObserver | null {
  const tag = (row: Element): void => {
    const text = (row as HTMLElement).innerText || row.textContent || ''
    if (HEBREW_CHAR_RE.test(text)) row.classList.add('rtl-row')
    else row.classList.remove('rtl-row')
  }
  const tagAll = (): void => {
    const rowsEl = host.querySelector('.xterm-rows')
    if (!rowsEl) return
    rowsEl.childNodes.forEach((n) => {
      if (n instanceof Element) tag(n)
    })
  }
  let scheduled = false
  const schedule = (): void => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      tagAll()
    })
  }
  const observer = new MutationObserver(() => schedule())
  const start = (): void => {
    const rowsEl = host.querySelector('.xterm-rows')
    if (!rowsEl) {
      requestAnimationFrame(start)
      return
    }
    observer.observe(rowsEl, { childList: true, subtree: true, characterData: true })
    tagAll()
  }
  start()
  return observer
}

