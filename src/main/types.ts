export interface SessionMeta {
  id: string
  name: string
  cwd: string
  color: string
  createdAt: number
  tmuxName: string
  imported?: boolean
}

export interface CreateSessionOpts {
  name: string
  cwd: string
  color?: string
  initialCommand?: string
}

export interface ExternalTmuxSession {
  name: string
  windows: number
  attached: boolean
  createdAt: number
}

export interface ImportSessionOpts {
  tmuxName: string
  displayName: string
  color?: string
}

export type SessionStatus = 'working' | 'idle' | 'awaiting' | 'detached' | 'shell'

export interface Bookmark {
  id: string
  sessionId: string
  label: string
  createdAt: number
  snapshot: string
}

export interface ProjectInfo {
  name: string
  path: string
  kind: string
}
