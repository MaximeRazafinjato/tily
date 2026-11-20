import { create } from 'zustand'
import { GitHistoryScope, type GitCommitDetails, type GitConflictFile, type GitDiff, type GitDiffSource, type GitHistory, type GitRefKind, type GitState } from '../bridge/gitMessages'
import type { ActionMenuItem } from '../components/ActionMenu'

export enum GitPromptKind {
  NewBranch = 'newBranch',
  RenameBranch = 'renameBranch',
  NewTag = 'newTag',
  Stash = 'stash',
}

export interface GitFileTarget {
  source: GitDiffSource
  path: string
  oldPath?: string
  untracked: boolean
  commit?: string
}

interface GitFailure {
  message: string
  output?: string
  warning?: boolean
}

interface GitRejection {
  branch: string
  message: string
  output: string
}

export interface GitConfirmation {
  title: string
  body: string
  detail?: string
  confirmLabel: string
  run: () => void
  restoreFocus?: () => void
}

export interface GitPrompt {
  kind: GitPromptKind
  label: string
  initial: string
  target?: string
  files?: string[]
  checkout: boolean
}

export interface GitRefHandle {
  kind: GitRefKind
  name: string
}

interface GitDrag {
  source: GitRefHandle
  x: number
  y: number
  target: GitRefHandle | null
}

export interface GitMenuRequest {
  x: number
  y: number
  label: string
  items: ActionMenuItem[]
  restoreFocus: () => void
}

interface GitSelection {
  keys: ReadonlySet<string>
  anchor: string | null
}

export interface GitDiffSelection {
  rows: ReadonlySet<number>
  anchor: number | null
  cursor: number | null
}

export const HISTORY_PAGE = 200
export const HISTORY_MAX = 10000

interface GitViewState {
  path: string
  resolved: string
  state: GitState | null
  displayRoot: string | null
  error: string | null
  graphOpen: boolean
  history: GitHistory | null
  historyError: string | null
  scope: GitHistoryScope
  historyCount: number
  reveal: string | null
  file: GitFileTarget | null
  commit: string | null
  diffRequest: number
  diff: GitDiff | null
  diffError: string | null
  diffSelection: GitDiffSelection
  conflictPath: string | null
  conflictRequest: number
  conflictFile: GitConflictFile | null
  conflictError: string | null
  detailsRequest: number
  details: GitCommitDetails | null
  detailsError: string | null
  busy: string | null
  busyRefs: string[]
  failure: GitFailure | null
  rejection: GitRejection | null
  confirmation: GitConfirmation | null
  prompt: GitPrompt | null
  message: string
  drafts: Record<string, string>
  committing: string | null
  amend: boolean
  drag: GitDrag | null
  menu: GitMenuRequest | null
  changeSelection: GitSelection
  refSelection: GitSelection
  follow: (path: string) => void
  receiveState: (path: string, state: GitState | null, error: string | null, displayRoot: string | null) => void
  setGraphOpen: (graphOpen: boolean) => void
  receiveHistory: (history: GitHistory, error: string | null) => void
  requestHistory: (scope: GitHistoryScope, count: number) => void
  requestReveal: (sha: string | null) => void
  showFile: (file: GitFileTarget, request: number) => void
  showCommit: (commit: string, request: number) => void
  selectWorkingTree: () => void
  clearSelection: () => void
  closeDrawer: () => void
  receiveDiff: (request: number, diff: GitDiff | null, error: string | null) => void
  showConflict: (path: string, request: number) => void
  receiveConflict: (request: number, file: GitConflictFile | null, error: string | null) => void
  receiveDetails: (request: number, details: GitCommitDetails | null, error: string | null) => void
  setBusy: (busy: string | null, busyRefs?: string[]) => void
  setFailure: (failure: GitFailure | null) => void
  setRejection: (rejection: GitRejection | null) => void
  confirm: (confirmation: GitConfirmation | null) => void
  setPrompt: (prompt: GitPrompt | null) => void
  setMessage: (message: string) => void
  setAmend: (amend: boolean, message: string) => void
  startCommit: (root: string) => void
  finishCommit: () => void
  setDrag: (drag: GitDrag | null) => void
  openMenu: (menu: GitMenuRequest | null) => void
  setChangeSelection: (changeSelection: GitSelection) => void
  setRefSelection: (refSelection: GitSelection) => void
  setDiffSelection: (diffSelection: GitDiffSelection) => void
}

const emptyDiffSelection: GitDiffSelection = { rows: new Set(), anchor: null, cursor: null }
const closedConflict = { conflictPath: null, conflictFile: null, conflictError: null }
const closedDrawer = { file: null, diff: null, diffError: null, diffSelection: emptyDiffSelection, ...closedConflict }
const noSelection = { ...closedDrawer, commit: null, details: null, detailsError: null }
const emptySelection: GitSelection = { keys: new Set(), anchor: null }

const draftsWith = (drafts: Record<string, string>, root: string, message: string): Record<string, string> => {
  const rest = Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== root))
  return message.trim().length > 0 ? { ...rest, [root]: message } : rest
}

export const useGitStore = create<GitViewState>()((set) => ({
  path: '',
  resolved: '',
  state: null,
  displayRoot: null,
  error: null,
  graphOpen: true,
  history: null,
  historyError: null,
  scope: GitHistoryScope.All,
  historyCount: HISTORY_PAGE,
  reveal: null,
  ...noSelection,
  diffRequest: 0,
  conflictRequest: 0,
  detailsRequest: 0,
  busy: null,
  busyRefs: [],
  failure: null,
  rejection: null,
  confirmation: null,
  prompt: null,
  message: '',
  drafts: {},
  committing: null,
  amend: false,
  drag: null,
  menu: null,
  changeSelection: emptySelection,
  refSelection: emptySelection,
  follow: (path) => set({ path }),
  receiveState: (path, state, error, displayRoot) =>
    set((current) => {
      if (current.path !== path) {
        return current
      }
      const sameRepository = Boolean(state && current.state?.root === state.root)
      const leaving = current.state
      const kept = leaving && (!current.amend || current.message !== leaving.lastMessage) ? draftsWith(current.drafts, leaving.root, current.message) : current.drafts
      const message = state ? (kept[state.root] ?? '') : ''
      const drafts = state ? draftsWith(kept, state.root, '') : kept
      return sameRepository
        ? { state, error, displayRoot, resolved: path }
        : { state, error, displayRoot, resolved: path, history: null, historyError: null, historyCount: HISTORY_PAGE, reveal: null, message, drafts, amend: false, prompt: null, rejection: null, failure: null, menu: null, drag: null, changeSelection: emptySelection, refSelection: emptySelection, ...noSelection }
    }),
  setGraphOpen: (graphOpen) => set({ graphOpen }),
  receiveHistory: (history, historyError) => set((current) => (current.state?.root === history.root ? { history, historyError } : current)),
  requestHistory: (scope, historyCount) => set({ scope, historyCount }),
  requestReveal: (reveal) => set({ reveal }),
  showFile: (file, diffRequest) =>
    set((current) => {
      const same = current.file?.path === file.path && current.file.source === file.source && current.file.commit === file.commit
      return { file, diffRequest, diff: same ? current.diff : null, diffError: null, diffSelection: same ? current.diffSelection : emptyDiffSelection, commit: file.commit ? current.commit : null, ...closedConflict }
    }),
  showConflict: (conflictPath, conflictRequest) =>
    set((current) => ({ ...closedDrawer, conflictPath, conflictRequest, conflictFile: current.conflictPath === conflictPath ? current.conflictFile : null, commit: null, details: null, detailsError: null })),
  receiveConflict: (request, conflictFile, conflictError) => set((current) => (current.conflictRequest === request ? { conflictFile, conflictError } : current)),
  showCommit: (commit, detailsRequest) => set({ ...noSelection, commit, detailsRequest }),
  selectWorkingTree: () => set((current) => (current.commit === null ? current : noSelection)),
  clearSelection: () => set(noSelection),
  closeDrawer: () => set(closedDrawer),
  receiveDiff: (request, diff, diffError) =>
    set((current) => {
      if (current.diffRequest !== request) {
        return current
      }
      const kept = diff?.fingerprint !== undefined && diff.fingerprint === current.diff?.fingerprint
      return { diff, diffError, diffSelection: kept ? current.diffSelection : { ...emptyDiffSelection, cursor: current.diffSelection.cursor } }
    }),
  receiveDetails: (request, details, detailsError) => set((current) => (current.detailsRequest === request ? { details, detailsError } : current)),
  setBusy: (busy, busyRefs = []) => set({ busy, busyRefs }),
  setFailure: (failure) => set({ failure }),
  setRejection: (rejection) => set({ rejection }),
  confirm: (confirmation) => set({ confirmation }),
  setPrompt: (prompt) => set({ prompt }),
  setMessage: (message) => set({ message }),
  setAmend: (amend, message) => set({ amend, message }),
  startCommit: (committing) => set({ committing }),
  finishCommit: () =>
    set((current) =>
      !current.committing || current.state?.root === current.committing
        ? { committing: null, amend: false, message: '' }
        : { committing: null, drafts: draftsWith(current.drafts, current.committing, '') },
    ),
  setDrag: (drag) => set({ drag }),
  openMenu: (menu) => set({ menu }),
  setChangeSelection: (changeSelection) => set({ changeSelection }),
  setRefSelection: (refSelection) => set({ refSelection }),
  setDiffSelection: (diffSelection) => set({ diffSelection }),
}))
