import { bridge } from '../bridge/bridge'
import { GitChangeKind, GitDiffSource, type GitConflict, type GitFailureCode, type GitFileChange, type GitHistoryScope, type GitWebMessage } from '../bridge/gitMessages'
import { HISTORY_MAX, HISTORY_PAGE, useGitStore, type GitConfirmation, type GitFileTarget, type GitMenuRequest } from '../store/gitStore'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { busyRefsOf } from './gitBusy'
import { absolutePath, currentName, fileName, OPERATION_LABELS, plural } from './gitLabels'

interface PendingRetry {
  operation: string
  confirm: (code: GitFailureCode) => void
}

let lastRequest = 0
let pendingRetry: PendingRetry | null = null
let detailsTimer: ReturnType<typeof setTimeout> | undefined

const nextRequest = (): number => ++lastRequest

const currentRoot = (): string | null => useGitStore.getState().state?.root ?? null

const send = (message: GitWebMessage, busy: boolean): void => {
  const store = useGitStore.getState()
  if (busy) {
    store.setBusy(message.type, busyRefsOf(message))
  }
  store.setFailure(null)
  bridge.send(message)
}

export const withRoot = (build: (path: string) => GitWebMessage, busy = true): void => {
  const root = currentRoot()
  if (root) {
    send(build(root), busy)
  }
}

export const askConfirmation = (confirmation: GitConfirmation): void => useGitStore.getState().confirm(confirmation)

export const retryOnFailure = (operation: string, confirm: (code: GitFailureCode) => void): void => {
  pendingRetry = { operation, confirm }
}

export const takeRetry = (operation: string): ((code: GitFailureCode) => void) | null => {
  const retry = pendingRetry?.operation === operation ? pendingRetry.confirm : null
  pendingRetry = null
  return retry
}

export const copyToClipboard = (text: string, done: string): void => {
  void navigator.clipboard
    .writeText(text)
    .then(() => useHostStore.getState().setStatus(done))
    .catch(() => useHostStore.getState().setStatus('Copie dans le presse-papiers impossible.', StatusLevel.Error))
}

let initializing: string | null = null

export const followRepository = (path: string): void => {
  if (useGitStore.getState().path !== path) {
    if (initializing !== path) {
      initializing = null
    }
    useGitStore.getState().follow(path)
    bridge.send({ type: 'git.watch', path })
  }
}

export const refreshRepository = (): void => bridge.send({ type: 'git.refresh' })

export const takeInitialized = (path: string): boolean => {
  const initialized = initializing === path
  if (initialized) {
    initializing = null
  }
  return initialized
}

export const initializeRepository = (path: string): void => {
  initializing = path
  bridge.send({ type: 'git.init', path })
  useHostStore.getState().setStatus(`Initialisation d’un dépôt Git dans ${path}…`)
}

export const setHistoryScope = (scope: GitHistoryScope): void => {
  useGitStore.getState().requestHistory(scope, HISTORY_PAGE)
  bridge.send({ type: 'git.history', scope, count: HISTORY_PAGE })
}

const requestHistoryCount = (count: number): void => {
  const { scope, requestHistory } = useGitStore.getState()
  requestHistory(scope, count)
  bridge.send({ type: 'git.history', scope, count })
}

export const loadMoreHistory = (): void => {
  const { history, historyCount } = useGitStore.getState()
  if (history?.hasMore && history.commits.length >= historyCount) {
    requestHistoryCount(historyCount + HISTORY_PAGE)
  }
}

export const loadUntilRevealed = (): void => {
  const { reveal, history, historyCount, requestReveal } = useGitStore.getState()
  const loading = history?.hasMore && history.commits.length < historyCount
  if (!reveal || !history || loading || history.commits.some((entry) => entry.sha === reveal)) {
    return
  }
  if (history.hasMore && historyCount < HISTORY_MAX) {
    requestHistoryCount(Math.min(HISTORY_MAX, historyCount * 2))
    return
  }
  requestReveal(null)
  useHostStore.getState().setStatus('Ce commit n’apparaît pas dans le graphe affiché : son détail reste visible dans le panneau Git.')
}

const requestDiff = (file: GitFileTarget): void => {
  const path = currentRoot()
  if (path) {
    const request = nextRequest()
    useGitStore.getState().showFile(file, request)
    bridge.send({ type: 'git.diff', path, request, source: file.source, file: file.path, oldFile: file.oldPath, commit: file.commit, untracked: file.untracked })
  }
}

export const showChange = (change: GitFileChange, source: GitDiffSource): void =>
  requestDiff({ source, path: change.path, oldPath: change.oldPath, untracked: change.kind === GitChangeKind.Untracked })

export const reloadDiff = (file: GitFileTarget): void => requestDiff(file)

const requestDetails = (commit: string, delay: number): void => {
  const path = currentRoot()
  if (path) {
    const request = nextRequest()
    useGitStore.getState().showCommit(commit, request)
    clearTimeout(detailsTimer)
    detailsTimer = setTimeout(() => bridge.send({ type: 'git.details', path, request, commit }), delay)
  }
}

export const showCommit = (commit: string, delay = 0): void => {
  const { commit: selected, detailsError } = useGitStore.getState()
  if (selected !== commit || detailsError) {
    requestDetails(commit, delay)
  }
}

export const retryFailedDetails = (): void => {
  const { commit, detailsError, file } = useGitStore.getState()
  if (commit && detailsError && !file) {
    requestDetails(commit, 0)
  }
}

export const selectWorkingTree = (): void => {
  clearTimeout(detailsTimer)
  useGitStore.getState().selectWorkingTree()
}

export const revealCommit = (commit: string): void => {
  showCommit(commit)
  useGitStore.getState().requestReveal(commit)
  loadUntilRevealed()
}

export const openGitMenu = (menu: GitMenuRequest): void => useGitStore.getState().openMenu(menu)

export const showCommitFile = (commit: string, change: GitFileChange): void =>
  requestDiff({ source: GitDiffSource.Commit, path: change.path, oldPath: change.oldPath, untracked: false, commit })

export const closeDrawer = (): void => useGitStore.getState().closeDrawer()

export const withOldPaths = (changes: GitFileChange[]): string[] => changes.flatMap((change) => (change.oldPath ? [change.path, change.oldPath] : [change.path]))

export const stageChanges = (changes: GitFileChange[]): void => withRoot((path) => ({ type: 'git.stage', path, files: changes.map((change) => change.path) }), false)

export const unstageChanges = (changes: GitFileChange[]): void => withRoot((path) => ({ type: 'git.unstage', path, files: withOldPaths(changes) }), false)

export const discardChanges = (changes: GitFileChange[], total: number): void => {
  const single = changes.length === 1 ? changes[0] : null
  askConfirmation({
    title: single ? `Abandonner les modifications de « ${fileName(single.path)} » ?` : `Abandonner ${plural(total, 'modification unstaged', 'modifications unstaged')} ?`,
    body: single
      ? single.kind === GitChangeKind.Untracked
        ? 'Ce fichier non suivi sera supprimé.'
        : 'Le fichier revient à sa version staged, sinon à celle du dernier commit.'
      : 'Les fichiers suivis reviennent à leur version staged, sinon à celle du dernier commit, et les fichiers non suivis sont supprimés.',
    detail: `${single ? `${single.path}\n` : ''}« Annuler » dans la vue Git peut encore les restaurer tant qu’aucune autre opération n’est faite.`,
    confirmLabel: 'Abandonner',
    run: () => withRoot((path) => ({ type: 'git.discard', path, files: changes.map((change) => change.path), confirmed: true }), false),
  })
}

export const commitChanges = (push: boolean): void => {
  const { message, amend, state, startCommit } = useGitStore.getState()
  if (state) {
    startCommit(state.root)
  }
  withRoot((path) => ({ type: 'git.commit', path, message, amend, push }))
}

export const fetchRemote = (): void => withRoot((path) => ({ type: 'git.fetch', path }))

export const pullBranch = (): void => withRoot((path) => ({ type: 'git.pull', path }))

export const pushBranch = (): void => withRoot((path) => ({ type: 'git.push', path, force: false, confirmed: false }))

export const forcePush = (): void => {
  const { rejection, state } = useGitStore.getState()
  const branch = rejection?.branch ?? (state ? currentName(state.head) : '')
  askConfirmation({
    title: `Forcer le push de « ${branch} » ?`,
    body: 'La branche distante sera remplacée par votre historique local avec git push --force-with-lease.',
    detail: 'Le push est refusé si la branche distante a changé depuis le dernier fetch : les commits d’autres personnes ne sont jamais écrasés sans que vous les ayez vus.',
    confirmLabel: 'Forcer le push',
    run: () => withRoot((path) => ({ type: 'git.push', path, force: true, confirmed: true })),
  })
}

export const undoLastOperation = (): void => withRoot((path) => ({ type: 'git.undo', path }))

export const openInEditor = (file: string): void => {
  const root = currentRoot()
  if (root) {
    bridge.send({ type: 'files.open', path: absolutePath(root, file) })
    useHostStore.getState().setStatus(`Ouverture dans l’éditeur : ${fileName(file)}`)
  }
}

export const resolveConflicts = (conflicts: GitConflict[]): void => {
  const files = conflicts.map((conflict) => conflict.path)
  const single = files.length === 1 ? files[0] : null
  retryOnFailure('git.resolve', () =>
    askConfirmation({
      title: single ? `Marquer « ${fileName(single)} » résolu malgré les marqueurs ?` : `Marquer ${plural(files.length, 'fichier', 'fichiers')} résolus malgré les marqueurs ?`,
      body: single ? 'Le fichier contient encore des lignes de marqueurs de conflit (<<<<<<< ou >>>>>>>).' : 'Au moins un fichier contient encore des lignes de marqueurs de conflit (<<<<<<< ou >>>>>>>).',
      detail: files.join('\n'),
      confirmLabel: 'Marquer résolu',
      run: () => withRoot((path) => ({ type: 'git.resolve', path, files, confirmed: true }), false),
    }),
  )
  withRoot((path) => ({ type: 'git.resolve', path, files, confirmed: false }), false)
}

export const resolveConflict = (conflict: GitConflict): void => resolveConflicts([conflict])

export const ignoreFiles = (files: string[]): void => withRoot((path) => ({ type: 'git.ignore', path, files }), false)

export const continueOperation = (): void => withRoot((path) => ({ type: 'git.continue', path }))

export const abortOperation = (): void => {
  const operation = useGitStore.getState().state?.operation
  if (operation) {
    askConfirmation({
      title: `Abandonner : ${OPERATION_LABELS[operation].toLowerCase()} en cours ?`,
      body: 'Le dépôt revient à son état d’avant l’opération ; les résolutions déjà faites sont perdues.',
      confirmLabel: 'Abandonner l’opération',
      run: () => withRoot((path) => ({ type: 'git.abort', path, confirmed: true })),
    })
  }
}
