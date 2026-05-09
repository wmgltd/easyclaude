import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Bookmark } from './types'

const FILE = () => join(app.getPath('userData'), 'bookmarks.json')

function load(): Bookmark[] {
  const path = FILE()
  if (!existsSync(path)) return []
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(bookmarks: Bookmark[]): void {
  const path = FILE()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(bookmarks, null, 2), 'utf8')
}

export class BookmarkStore {
  private bookmarks: Bookmark[] = load()

  list(sessionId: string): Bookmark[] {
    return this.bookmarks.filter((b) => b.sessionId === sessionId)
  }

  create(sessionId: string, label: string, snapshot: string): Bookmark {
    const b: Bookmark = {
      id: randomUUID().slice(0, 8),
      sessionId,
      label,
      createdAt: Date.now(),
      snapshot
    }
    this.bookmarks.unshift(b)
    save(this.bookmarks)
    return b
  }

  remove(id: string): void {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id)
    save(this.bookmarks)
  }

  removeAllForSession(sessionId: string): void {
    this.bookmarks = this.bookmarks.filter((b) => b.sessionId !== sessionId)
    save(this.bookmarks)
  }
}
