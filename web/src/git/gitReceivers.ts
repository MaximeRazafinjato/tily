import { GitChangeKind, GitDiffSource, type GitCommitDetails, type GitDiff, type GitFailureCode, type GitFileChange, type GitHistory, type GitState } from '../bridge/gitMessages'
import { useGitStore, type GitFileTarget } from '../store/gitStore'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { diffHasFocus, refocusGitIfLost, requestDiffFocus, restoreDiffFocus } from './gitFocus'
import { clearRefSelection } from './gitRefSelection'
import { closeDrawer, loadUntilRevealed, reloadDiff, retryFailedDetails, selectWorkingTree, showChange, takeInitialized, takeRetry } from './gitRequests'
import { GitRowGroup, rowKey } from './gitRows'

const COMMIT_OPERATION = 'git.commit'
const AUTO_FETCH_OPERATION = 'git.autoFetch'

const changesOf = (state: GitState | null, source: GitDiffSource): GitFileChange[] => (!state ? [] : source === GitDiffSource.Staged ? state.staged : state.unstaged)

const nextChange = (before: GitFileChange[], after: GitFileChange[], path: string): GitFileChange | undefined => {
  const index = before.findIndex((change) => change.path === path)
  const remaining = (change: GitFileChange) => after.find((candidate) => candidate.path === change.path)
  return index < 0 ? undefined : (before.slice(index + 1).map(remaining).find(Boolean) ?? before.slice(0, index).map(remaining).findLast(Boolean) ?? after[0])
}

const followShownFile = (previous: GitState | null, state: GitState, file: GitFileTarget): void => {
  const changes = changesOf(state, file.source)
  const stillThere = changes.find((change) => change.path === file.path)
  const next = stillThere ? undefined : nextChange(changesOf(previous, file.source), changes, file.path)
  if (stillThere) {
    reloadDiff({ ...file, untracked: stillThere.kind === GitChangeKind.Untracked })
  } else if (next) {
    const focused = diffHasFocus()
    const key = rowKey(file.source === GitDiffSource.Staged ? GitRowGroup.Staged : GitRowGroup.Unstaged, next.path)
    useGitStore.getState().setChangeSelection({ keys: new Set([key]), anchor: key })
    showChange(next, file.source)
    if (focused) {
      requestDiffFocus(useGitStore.getState().diffRequest)
    }
  } else {
    closeDrawer()
  }
}

const finishBusy = (operation: string): void => {
  const store = useGitStore.getState()
  if (store.busy === operation) {
    store.setBusy(null)
  }
}

export const receiveGitState = (path: string, state: GitState | undefined, error: string | undefined, displayRoot: string | undefined): void => {
  const previous = useGitStore.getState().state
  useGitStore.getState().receiveState(path, state ?? null, error ?? null, displayRoot ?? null)
  if (takeInitialized(path)) {
    if (state) {
      useHostStore.getState().setStatus(`Dépôt Git initialisé dans ${state.root}${state.head.branch ? ` (branche ${state.head.branch})` : ''}.`)
    } else if (error) {
      useHostStore.getState().setStatus(error, StatusLevel.Error)
    }
  }
  if (state && state.conflicts.length > 0 && (previous?.conflicts.length ?? 0) === 0) {
    selectWorkingTree()
  }
  const { file, commit } = useGitStore.getState()
  if (state && file && !commit) {
    followShownFile(previous, state, file)
  }
  retryFailedDetails()
  refocusGitIfLost()
}

export const receiveGitChanged = (path: string): void => {
  const { path: followed, file, commit } = useGitStore.getState()
  if (followed === path && file && !commit) {
    reloadDiff(file)
  }
}

export const receiveGitHistory = (history: GitHistory, error: string | undefined): void => {
  useGitStore.getState().receiveHistory(history, error ?? null)
  loadUntilRevealed()
}

export const receiveGitDiff = (request: number, diff: GitDiff | undefined, error: string | undefined): void => {
  useGitStore.getState().receiveDiff(request, diff ?? null, error ?? null)
  if (useGitStore.getState().diffRequest === request) {
    restoreDiffFocus(request)
  }
}

export const receiveGitDetails = (request: number, details: GitCommitDetails | undefined, error: string | undefined): void =>
  useGitStore.getState().receiveDetails(request, details ?? null, error ?? null)

export const receiveGitAutoFetchStarted = (path: string): void => {
  const store = useGitStore.getState()
  if (store.busy === null && store.state?.root === path) {
    store.setBusy(AUTO_FETCH_OPERATION)
  }
}

export const receiveGitAutoFetchEnded = (): void => finishBusy(AUTO_FETCH_OPERATION)

export const receiveGitDone = (operation: string, message: string, warning: boolean, output: string | undefined): void => {
  finishBusy(operation)
  const store = useGitStore.getState()
  takeRetry(operation)
  if (operation === COMMIT_OPERATION) {
    store.finishCommit()
  }
  if (operation === COMMIT_OPERATION || operation === 'git.push') {
    store.setRejection(null)
  }
  const stashShown = store.state?.stashes.some((stash) => stash.sha === store.commit)
  if (operation === 'git.stashApply' || (operation === 'git.stashDrop' && stashShown)) {
    selectWorkingTree()
  }
  if (operation === 'git.refsDelete') {
    clearRefSelection()
  }
  if (output) {
    store.setFailure({ message, output, warning })
  }
  useHostStore.getState().setStatus(message, warning ? StatusLevel.Warning : StatusLevel.Info)
}

export const receiveGitFailed = (operation: string, message: string, output: string | undefined, code: GitFailureCode | undefined): void => {
  finishBusy(operation)
  const retry = takeRetry(operation)
  if (code && retry) {
    retry()
    return
  }
  useGitStore.getState().setFailure({ message, output })
  useHostStore.getState().setStatus(message, StatusLevel.Error)
}

export const receiveGitPushRejected = (operation: string, branch: string, message: string, output: string): void => {
  finishBusy(operation)
  const store = useGitStore.getState()
  if (operation === COMMIT_OPERATION) {
    store.finishCommit()
  }
  store.setRejection({ branch, message, output })
  useHostStore.getState().setStatus(message, StatusLevel.Warning)
}
