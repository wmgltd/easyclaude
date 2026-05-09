import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ProjectInfo } from './types'

const PROJECT_MARKERS: Array<[string, string]> = [
  ['package.json', 'node'],
  ['Cargo.toml', 'rust'],
  ['pyproject.toml', 'python'],
  ['composer.json', 'php'],
  ['go.mod', 'go'],
  ['Gemfile', 'ruby'],
  ['.git', 'git']
]

function detectKind(dir: string): string | null {
  for (const [file, kind] of PROJECT_MARKERS) {
    if (existsSync(join(dir, file))) return kind
  }
  return null
}

function defaultRoots(): string[] {
  const home = homedir()
  return [join(home, 'KobisWorkspace')]
}

export function scanProjects(roots: string[] = defaultRoots()): ProjectInfo[] {
  const out: ProjectInfo[] = []
  const seen = new Set<string>()
  for (const root of roots) {
    if (!existsSync(root)) continue
    let entries: string[] = []
    try {
      entries = readdirSync(root)
    } catch {
      continue
    }
    for (const name of entries) {
      if (name.startsWith('.')) continue
      if (name === 'node_modules') continue
      const path = join(root, name)
      if (seen.has(path)) continue
      let isDir = false
      try {
        isDir = statSync(path).isDirectory()
      } catch {
        continue
      }
      if (!isDir) continue
      const kind = detectKind(path)
      if (!kind) continue
      seen.add(path)
      out.push({ name, path, kind })
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}
