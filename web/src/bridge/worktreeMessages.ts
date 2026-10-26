export enum WorktreeBranchMode {
  New = 'new',
  Local = 'local',
  Remote = 'remote',
}

export enum WorktreeOperation {
  Create = 'create',
  Remove = 'remove',
}

export interface Worktree {
  path: string
  branch?: string
  head?: string
  isMain: boolean
  isDetached: boolean
  locked: boolean
  prunable: boolean
}

export interface WorktreePlan {
  repository: string
  project: string
  path?: string
  localBranch?: string
  defaultBase?: string
  localBranches: string[]
  remoteBranches: string[]
  error?: string
  configuredBase?: string
  folder?: string
  defaultFolder?: string
  pathPreview?: string
}

export interface WorktreeProjectFolder {
  project: string
  folder: string
}

export interface WorktreeSources {
  project: string
  repositories: string[]
  selected?: string
  defaultRepository?: string
}

export interface WorktreeSettings {
  folder: string
  defaultBase: string
}

export type WorktreeHostMessage =
  | { type: 'worktrees.sourcesFound'; request: number; sources: WorktreeSources }
  | { type: 'worktrees.planned'; request: number; plan: WorktreePlan }
  | { type: 'worktrees.listed'; request: number; root?: string; worktrees?: Worktree[]; error?: string }
  | { type: 'worktrees.progress'; request?: number; operation: WorktreeOperation; message: string }
  | { type: 'worktrees.created'; request?: number; path: string; name: string; branch: string; install?: string; claude?: string }
  | { type: 'worktrees.done'; request?: number; operation: WorktreeOperation; message: string; warnings: string[] }
  | { type: 'worktrees.failed'; request?: number; operation: WorktreeOperation; step: string; message: string; output?: string; lockedBy?: string[] }
  | { type: 'worktrees.purging'; name: string; files: number; elapsedMs: number }
  | { type: 'worktrees.purged'; names: string[]; files: number; elapsedMs: number; remaining: string[] }

export type WorktreeWebMessage =
  | { type: 'worktrees.sources'; request: number; path?: string; project?: string }
  | { type: 'worktrees.plan'; request: number; repository: string; branch: string; mode: WorktreeBranchMode; base?: string; project: string; folder?: string }
  | { type: 'worktrees.list'; request: number; path: string }
  | {
      type: 'worktrees.create'
      request: number
      repository: string
      branch: string
      mode: WorktreeBranchMode
      base?: string
      install: boolean
      claude?: boolean
      database: boolean
      project: string
      remember: boolean
      folder?: string
      rememberFolder: boolean
    }
  | { type: 'worktrees.remove'; request: number; path: string; keepBranch: boolean; dropDatabase: boolean; confirmed: boolean }
