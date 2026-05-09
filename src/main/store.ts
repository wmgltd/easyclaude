import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { SessionMeta } from './types'

const STORE_FILE = () => join(app.getPath('userData'), 'sessions.json')

export function loadSessions(): SessionMeta[] {
  const path = STORE_FILE()
  if (!existsSync(path)) return []
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

export function saveSessions(sessions: SessionMeta[]): void {
  const path = STORE_FILE()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(sessions, null, 2), 'utf8')
}
