import type { Worktree } from './worktreeMessages'

export enum GitChangeKind {
  Modified = 'modified',
  Added = 'added',
  Deleted = 'deleted',
  Renamed = 'renamed',
  Copied = 'copied',
  TypeChanged = 'typeChanged',
  Untracked = 'untracked',
}

export enum GitConflictKind {
  BothModified = 'bothModified',
  BothAdded = 'bothAdded',
  BothDeleted = 'bothDeleted',
  AddedByUs = 'addedByUs',
  AddedByThem = 'addedByThem',
  DeletedByUs = 'deletedByUs',
  DeletedByThem = 'deletedByThem',
}

export enum GitOperationKind {
  Merge = 'merge',
  Rebase = 'rebase',
  CherryPick = 'cherryPick',
  Revert = 'revert',
}

export enum GitHistoryScope {
  All = 'all',
  Current = 'current',
}

export enum GitRefKind {
  Head = 'head',
  Branch = 'branch',
  Remote = 'remote',
  Tag = 'tag',
}

export enum GitSegmentKind {
  Through = 'through',
  In = 'in',
  Out = 'out',
}

export enum GitDiffLineKind {
  Context = 'context',
  Added = 'added',
  Removed = 'removed',
  Note = 'note',
}

export enum GitDiffSource {
  Unstaged = 'unstaged',
  Staged = 'staged',
  Commit = 'commit',
}

export enum GitFailureCode {
  NotMerged = 'notMerged',
  ConflictMarkers = 'conflictMarkers',
}

export enum GitResetMode {
  Soft = 'soft',
  Mixed = 'mixed',
  Hard = 'hard',
}

export enum GitSwitchTarget {
  Branch = 'branch',
  Remote = 'remote',
  Commit = 'commit',
}

export interface GitFileChange {
  path: string
  oldPath?: string
  kind: GitChangeKind
}

export interface GitConflict {
  path: string
  kind: GitConflictKind
}

export interface GitHead {
  branch?: string
  sha?: string
  detached: boolean
  unborn: boolean
  upstream?: string
  ahead: number
  behind: number
}

export interface GitBranch {
  name: string
  sha: string
  upstream?: string
  ahead: number
  behind: number
  gone: boolean
  current: boolean
  merged: boolean
}

export interface GitRemoteBranch {
  name: string
  remote: string
  branch: string
  sha: string
}

export interface GitTag {
  name: string
  sha: string
}

export interface GitStash {
  index: number
  sha: string
  message: string
  base: string
  author: string
  email: string
  date: number
}

interface GitUndoInfo {
  label: string
  available: boolean
  reason?: string
}

export interface GitState {
  root: string
  name: string
  head: GitHead
  operation?: GitOperationKind
  staged: GitFileChange[]
  unstaged: GitFileChange[]
  conflicts: GitConflict[]
  stagedTotal: number
  unstagedTotal: number
  branches: GitBranch[]
  remoteBranches: GitRemoteBranch[]
  tags: GitTag[]
  stashes: GitStash[]
  remotes: string[]
  lastMessage?: string
  undo?: GitUndoInfo
  forcePushAllowed: boolean
  worktrees: Worktree[]
}

export interface GitGraphSegment {
  from: number
  to: number
  color: number
  kind: GitSegmentKind
  dashed?: boolean
}

export interface GitGraphRow {
  lane: number
  color: number
  width: number
  segments: GitGraphSegment[]
}

export interface GitRefLabel {
  name: string
  kind: GitRefKind
  current: boolean
  remotes: string[]
}

export interface GitCommit {
  sha: string
  parents: string[]
  author: string
  email: string
  date: number
  subject: string
  refs: GitRefLabel[]
  graph: GitGraphRow
  stash?: boolean
  pushable?: boolean
}

export interface GitHistory {
  root: string
  scope: GitHistoryScope
  commits: GitCommit[]
  hasMore: boolean
  workingTree: GitGraphRow
}

export interface GitCommitDetails {
  sha: string
  parents: string[]
  author: string
  email: string
  date: number
  message: string
  files: GitFileChange[]
}

export interface GitDiffLine {
  kind: GitDiffLineKind
  old?: number
  new?: number
  text: string
}

interface GitDiffHunk {
  header: string
  lines: GitDiffLine[]
}

export interface GitHunkSelection {
  hunk: number
  lines: number[]
}

export interface GitDiff {
  path: string
  oldPath?: string
  binary: boolean
  truncated: boolean
  notes: string[]
  hunks: GitDiffHunk[]
  fingerprint?: string
  patch?: string | null
}

export interface GitSettings {
  autoFetch: boolean
}

export type GitHostMessage =
  | { type: 'git.state'; path: string; state?: GitState; error?: string; displayRoot?: string }
  | { type: 'git.changed'; path: string }
  | { type: 'git.history'; history: GitHistory; error?: string }
  | { type: 'git.diff'; request: number; result?: GitDiff; error?: string }
  | { type: 'git.details'; request: number; result?: GitCommitDetails; error?: string }
  | { type: 'git.done'; operation: string; message: string; warning: boolean; output?: string }
  | { type: 'git.failed'; operation: string; message: string; output?: string; code?: GitFailureCode }
  | { type: 'git.pushRejected'; operation: string; branch: string; message: string; output: string }
  | { type: 'git.autoFetchStarted'; path: string }
  | { type: 'git.autoFetchEnded'; path: string }

export type GitWebMessage =
  | { type: 'git.watch'; path: string }
  | { type: 'git.refresh' }
  | { type: 'git.init'; path: string }
  | { type: 'git.history'; scope: GitHistoryScope; count: number }
  | { type: 'git.diff'; path: string; request: number; source: GitDiffSource; file: string; oldFile?: string; commit?: string; untracked: boolean }
  | { type: 'git.details'; path: string; request: number; commit: string }
  | { type: 'git.stage' | 'git.unstage' | 'git.ignore'; path: string; files: string[] }
  | { type: 'git.discard'; path: string; files: string[]; confirmed: boolean }
  | { type: 'git.stageLines' | 'git.unstageLines' | 'git.discardLines'; path: string; file: string; untracked: boolean; fingerprint: string; selection: GitHunkSelection[]; confirmed: boolean }
  | { type: 'git.commit'; path: string; message: string; amend: boolean; push: boolean }
  | { type: 'git.push'; path: string; force: boolean; confirmed: boolean }
  | { type: 'git.pushBranch'; path: string; branch: string; commit?: string }
  | { type: 'git.pull' | 'git.fetch' | 'git.continue' | 'git.undo'; path: string }
  | { type: 'git.merge' | 'git.rebase'; path: string; reference: string }
  | { type: 'git.cherryPick'; path: string; commit: string }
  | { type: 'git.revert'; path: string; commit: string }
  | { type: 'git.reset'; path: string; commit: string; mode: GitResetMode; confirmed: boolean }
  | { type: 'git.switch'; path: string; reference: string; target: GitSwitchTarget }
  | { type: 'git.branchCreate'; path: string; name: string; reference?: string; checkout: boolean }
  | { type: 'git.branchRename'; path: string; name: string; newName: string }
  | { type: 'git.branchDelete'; path: string; name: string; force: boolean; confirmed: boolean }
  | { type: 'git.remoteBranchDelete'; path: string; reference: string; confirmed: boolean }
  | { type: 'git.refsDelete'; path: string; branches: string[]; remoteBranches: string[]; tags: string[]; stashes: string[]; confirmed: boolean }
  | { type: 'git.tagCreate'; path: string; name: string; commit: string }
  | { type: 'git.tagDelete' | 'git.tagPush'; path: string; name: string }
  | { type: 'git.stash'; path: string; message: string; files: string[] }
  | { type: 'git.stashApply'; path: string; index: number; commit: string; pop: boolean }
  | { type: 'git.stashDrop'; path: string; index: number; commit: string; confirmed: boolean }
  | { type: 'git.resolve'; path: string; files: string[]; confirmed: boolean }
  | { type: 'git.abort'; path: string; confirmed: boolean }
