import { app } from 'electron'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Bookmark } from './types'
import { writeAtomic, loadWithFallback } from './atomic'

const FILE = (): string => join(app.getPath('userData'), 'bookmarks.json')

function load(): Bookmark[] {
  return (
    loadWithFallback<Bookmark[]>(FILE(), (raw) => {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as Bookmark[]) : null
    }) ?? []
  )
}

function save(bookmarks: Bookmark[]): void {
  writeAtomic(FILE(), JSON.stringify(bookmarks, null, 2))
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
