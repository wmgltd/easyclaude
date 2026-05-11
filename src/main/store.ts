import { app } from 'electron'
import { join } from 'node:path'
import type { SessionMeta } from './types'
import { writeAtomic, loadWithFallback } from './atomic'

const STORE_FILE = (): string => join(app.getPath('userData'), 'sessions.json')

export function loadSessions(): SessionMeta[] {
  return (
    loadWithFallback<SessionMeta[]>(STORE_FILE(), (raw) => {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as SessionMeta[]) : null
    }) ?? []
  )
}

export function saveSessions(sessions: SessionMeta[]): void {
  writeAtomic(STORE_FILE(), JSON.stringify(sessions, null, 2))
}
