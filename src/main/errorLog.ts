import { app, crashReporter, shell } from 'electron'
import { existsSync, appendFileSync, statSync, renameSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const MAX_LOG_BYTES = 1_000_000 // 1MB → rotate to error-log.1.txt

export function getErrorLogPath(): string {
  return join(app.getPath('userData'), 'error-log.txt')
}

export function getCrashDumpsPath(): string {
  // Set explicitly so it lives next to error-log.txt instead of the OS default.
  return join(app.getPath('userData'), 'crashes')
}

function rotateIfLarge(path: string): void {
  try {
    if (!existsSync(path)) return
    const size = statSync(path).size
    if (size < MAX_LOG_BYTES) return
    const rotated = path.replace(/\.txt$/, '.1.txt')
    renameSync(path, rotated)
  } catch {
    /* best-effort */
  }
}

/**
 * Append a single error entry to the log file. Format is one line per entry
 * to make it easy to tail/grep. JSON keeps fields parseable later.
 */
export function appendErrorEntry(entry: {
  source: 'main' | 'renderer' | 'native'
  kind: string
  message: string
  stack?: string
  context?: Record<string, unknown>
}): void {
  try {
    const path = getErrorLogPath()
    mkdirSync(dirname(path), { recursive: true })
    rotateIfLarge(path)
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      ...entry
    })
    appendFileSync(path, line + '\n', 'utf8')
  } catch {
    /* swallow — error logging must never crash the process */
  }
}

/**
 * Wire up native crash dumps + unhandled exception/rejection logging in main.
 * Call once, before `app.whenReady()`.
 */
export function initErrorLogging(): void {
  // 1. Native (C++) crashes — Electron writes minidumps locally; we never
  //    upload anywhere automatically.
  try {
    app.setPath('crashDumps', getCrashDumpsPath())
    crashReporter.start({
      productName: 'PikudClaude',
      companyName: 'WMG',
      submitURL: 'https://example.invalid/no-upload',
      uploadToServer: false,
      compress: true
    })
  } catch (err) {
    appendErrorEntry({
      source: 'main',
      kind: 'crashReporter-init-failed',
      message: err instanceof Error ? err.message : String(err)
    })
  }

  // 2. Main-process JS exceptions
  process.on('uncaughtException', (err) => {
    appendErrorEntry({
      source: 'main',
      kind: 'uncaughtException',
      message: err.message,
      stack: err.stack
    })
  })
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason))
    appendErrorEntry({
      source: 'main',
      kind: 'unhandledRejection',
      message: err.message,
      stack: err.stack
    })
  })
}

/**
 * Open the userData folder in Finder so the user can find the log and any
 * crash dumps to attach to a bug report.
 */
export async function revealErrorLog(): Promise<void> {
  await shell.openPath(app.getPath('userData'))
}
