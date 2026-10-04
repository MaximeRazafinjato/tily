export enum UpdateStatus {
  Idle = 'idle',
  Checking = 'checking',
  UpToDate = 'upToDate',
  Available = 'available',
  Downloading = 'downloading',
  Ready = 'ready',
  Failed = 'failed',
}

export interface UpdateRelease {
  version: string
  name: string
  notes: string[]
  url: string
  publishedAt?: string
  size: number
}

export interface UpdateInfo {
  current: string
  status: UpdateStatus
  release?: UpdateRelease
  received: number
  total: number
  error?: string
  checkedAt?: string
  blocked?: string
  releasesPage: string
}

export interface UpdateSettings {
  autoCheck: boolean
}

export type UpdateHostMessage =
  | ({ type: 'update.state' } & UpdateInfo)
  | { type: 'update.restart' }
  | { type: 'update.confirmRestart'; id: string; version: string }
  | { type: 'update.notice'; message: string; warning: boolean }

export type UpdateWebMessage =
  | { type: 'update.check' }
  | { type: 'update.install' }
  | { type: 'update.cancel' }
  | { type: 'update.apply' }
  | { type: 'update.restartAnswer'; id: string; confirmed: boolean }
