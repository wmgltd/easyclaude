import { useEffect, useState } from 'react'
import type { ProjectInfo } from '../types'

const COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']
const RECENT_KEY = 'easyclaude.recentProjects'
const RECENT_MAX = 6

interface RecentProject {
  name: string
  path: string
}

function loadRecents(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

function saveRecent(p: RecentProject): void {
  const existing = loadRecents().filter((r) => r.path !== p.path)
  const next = [p, ...existing].slice(0, RECENT_MAX)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

interface Props {
  onCreate: (opts: {
    name: string
    cwd: string
    color: string
    initialCommand: string
  }) => Promise<void>
  onCancel: () => void
  onSwitchToImport: () => void
  defaultInitialCommand?: string
  defaultCwd?: string
  defaultColor?: string
  recentMax?: number
}

export function NewSessionDialog({
  onCreate,
  onCancel,
  onSwitchToImport,
  defaultInitialCommand = 'claude',
  defaultCwd = '',
  defaultColor,
  recentMax = RECENT_MAX
}: Props): JSX.Element {
  const [name, setName] = useState('')
  const [cwd, setCwd] = useState(defaultCwd)
  const [color, setColor] = useState(defaultColor ?? COLORS[0])
  const [initialCommand, setInitialCommand] = useState(defaultInitialCommand)
  const [busy, setBusy] = useState(false)
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [recents] = useState<RecentProject[]>(loadRecents().slice(0, recentMax))
  const [filter, setFilter] = useState('')

  useEffect(() => {
    window.api.scanProjects().then(setProjects)
  }, [])

  const pickDir = async () => {
    const picked = await window.api.pickDirectory()
    if (picked) {
      setCwd(picked)
      if (!name) {
        const segments = picked.split('/').filter(Boolean)
        setName(segments[segments.length - 1] ?? '')
      }
    }
  }

  const pickProject = (p: { name: string; path: string }) => {
    setCwd(p.path)
    setName(p.name)
  }

  const submit = async () => {
    if (!name.trim() || !cwd.trim()) return
    setBusy(true)
    saveRecent({ name: name.trim(), path: cwd.trim() })
    try {
      await onCreate({ name: name.trim(), cwd: cwd.trim(), color, initialCommand })
    } finally {
      setBusy(false)
    }
  }

  const filtered = filter.trim()
    ? projects.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : projects

  const recentPaths = new Set(recents.map((r) => r.path))
  const recentList = recents.filter((r) => !filter.trim() || r.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog wide-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-tabs">
          <button className="dialog-tab active" type="button">Create new</button>
          <button className="dialog-tab" type="button" onClick={onSwitchToImport}>
            Import existing
          </button>
        </div>

        {(projects.length > 0 || recents.length > 0) && (
          <div className="field">
            <label>Pick a project</label>
            <input
              type="text"
              placeholder="Filter projects…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="project-grid">
              {recentList.length > 0 && (
                <>
                  <div className="project-section-title">recent</div>
                  {recentList.map((r) => (
                    <div
                      key={`r:${r.path}`}
                      className={`project-card recent ${cwd === r.path ? 'selected' : ''}`}
                      onClick={() => pickProject(r)}
                    >
                      <div className="project-name">{r.name}</div>
                      <div className="project-path">{shortPath(r.path)}</div>
                    </div>
                  ))}
                </>
              )}
              {filtered.length > 0 && (
                <>
                  <div className="project-section-title">all</div>
                  {filtered.filter((p) => !recentPaths.has(p.path)).map((p) => (
                    <div
                      key={p.path}
                      className={`project-card ${cwd === p.path ? 'selected' : ''}`}
                      onClick={() => pickProject(p)}
                      title={p.path}
                    >
                      <div className="project-name">{p.name}</div>
                      <div className="project-path">{p.kind}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        <div className="field">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. supervision"
          />
        </div>

        <div className="field">
          <label>Working directory</label>
          <div className="field-row">
            <input
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="/Users/you/projects/..."
            />
            <button onClick={pickDir} type="button">Browse</button>
          </div>
        </div>

        <div className="field">
          <label>Initial command (optional)</label>
          <input
            type="text"
            value={initialCommand}
            onChange={(e) => setInitialCommand(e.target.value)}
            placeholder="claude"
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

        <div className="dialog-actions">
          <button onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="primary" onClick={submit} disabled={busy || !name.trim() || !cwd.trim()}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function shortPath(p: string): string {
  const home = '/Users/'
  if (p.startsWith(home)) {
    const rest = p.slice(home.length)
    const parts = rest.split('/')
    if (parts.length > 1) return `~/${parts.slice(1).join('/')}`
  }
  return p
}
