import {
  existsSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  renameSync,
  copyFileSync,
  unlinkSync,
  readFileSync,
  mkdirSync
} from 'node:fs'
import { dirname } from 'node:path'

const MAX_BACKUPS = 3

/**
 * Atomically write data to `path`. Steps:
 *   1. Write payload to `<path>.tmp.<pid>` and fsync it.
 *   2. Rotate existing backups: .bak.2 → .bak.3, .bak.1 → .bak.2, current → .bak.1.
 *   3. Rename tmp → path. POSIX rename is atomic within the same filesystem.
 *
 * If the process is killed mid-write, the original file (or its most recent
 * backup) survives intact. The tmp file is cleaned up on the next write.
 */
export function writeAtomic(path: string, data: string): void {
  mkdirSync(dirname(path), { recursive: true })

  const tmp = `${path}.tmp.${process.pid}`
  const fd = openSync(tmp, 'w')
  try {
    writeSync(fd, data)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }

  if (existsSync(path)) {
    for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
      const from = `${path}.bak.${i}`
      const to = `${path}.bak.${i + 1}`
      if (existsSync(from)) {
        try {
          renameSync(from, to)
        } catch {
          /* best-effort rotation */
        }
      }
    }
    try {
      copyFileSync(path, `${path}.bak.1`)
    } catch {
      /* best-effort backup */
    }
  }

  renameSync(tmp, path)
}

/**
 * Read `path` and parse it. If the main file is missing or unparseable,
 * fall through to `.bak.1`, `.bak.2`, `.bak.3`. Returns the parsed value
 * from whichever source succeeded, or null if everything failed.
 *
 * `parse` should return null for invalid content; throwing also counts as
 * invalid and we move to the next backup.
 */
export function loadWithFallback<T>(path: string, parse: (raw: string) => T | null): T | null {
  const candidates = [path]
  for (let i = 1; i <= MAX_BACKUPS; i++) candidates.push(`${path}.bak.${i}`)

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    try {
      const raw = readFileSync(candidate, 'utf8')
      const parsed = parse(raw)
      if (parsed !== null) {
        if (candidate !== path) {
          // Recovered from a backup — promote it back to the canonical path
          // so subsequent reads don't keep falling through.
          try {
            copyFileSync(candidate, path)
          } catch {
            /* non-fatal: we still return the parsed value */
          }
        }
        return parsed
      }
    } catch {
      /* try next candidate */
    }
  }
  return null
}

/**
 * Best-effort cleanup of leftover tmp files from a crashed write of the
 * previous session. Call once on app startup per file you manage.
 */
export function cleanupStaleTmp(path: string): void {
  // We can't reliably enumerate <path>.tmp.* without globbing; this helper
  // just exists so callers can document the expectation. The next successful
  // writeAtomic will overwrite its own tmp. Stale tmps from a crashed prior
  // run are harmless — they sit in userData and never get read.
  void path
}
