export enum UpdateStatus {
  Idle = 'idle',
  Checking = 'checking',
  UpToDate = 'upToDate',
  Available = 'available',
  Downloading = 'downloading',
  Ready = 'ready',
  Failed = 'failed',
}

export interface UpdateReleaseNote {
  title?: string | null
  text: string
}

export interface UpdateRelease {
  version: string
  name: string
  notes: UpdateReleaseNote[]
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

export type UpdateHostMessage = ({ type: 'update.state' } & UpdateInfo) | { type: 'update.restart' }

export type UpdateWebMessage = { type: 'update.check' } | { type: 'update.install' } | { type: 'update.cancel' } | { type: 'update.apply' }
