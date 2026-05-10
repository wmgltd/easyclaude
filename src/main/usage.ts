import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ActiveUsageBlock {
  startTime: string
  endTime: string
  totalTokens: number
  costUSD: number
  msUntilReset: number
  percentUsed: number | null
}

interface CcusageBlock {
  isActive?: boolean
  isGap?: boolean
  startTime?: string
  endTime?: string
  totalTokens?: number
  costUSD?: number
  tokenLimitStatus?: {
    limit?: number
    percentUsed?: number
  }
}

export async function getActiveBlock(): Promise<ActiveUsageBlock | null> {
  try {
    const { stdout } = await execFileAsync(
      'npx',
      ['--yes', '--quiet', 'ccusage@latest', 'blocks', '--active', '--token-limit', 'max', '--json'],
      { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 }
    )
    const data = JSON.parse(stdout) as { blocks?: CcusageBlock[] }
    const blocks = Array.isArray(data.blocks) ? data.blocks : []
    const active = blocks.find((b) => b.isActive && !b.isGap)
    if (!active || !active.endTime || !active.startTime) return null
    const endMs = Date.parse(active.endTime)
    if (!Number.isFinite(endMs)) return null
    const tokens = active.totalTokens ?? 0
    const limit = active.tokenLimitStatus?.limit ?? 0
    const pct = limit > 0 ? Math.min(100, (tokens / limit) * 100) : null
    return {
      startTime: active.startTime,
      endTime: active.endTime,
      totalTokens: tokens,
      costUSD: active.costUSD ?? 0,
      msUntilReset: Math.max(0, endMs - Date.now()),
      percentUsed: pct
    }
  } catch {
    return null
  }
}
