import { bridge } from '../bridge/bridge'
import { OpenTarget, type GitContext } from '../bridge/messages'
import { requestBranchMergeRequests } from '../forge/mergeRequestActions'
import { allPanes, type Pane } from '../model/session'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'

const pendingBranchCopies = new Set<string>()

const paneById = (paneId: string): Pane | undefined => {
  const { session } = useSessionStore.getState()
  return session ? allPanes(session).find((pane) => pane.id === paneId) : undefined
}

export const gitSummary = (context: GitContext | undefined): string => {
  if (!context) {
    return 'Contexte Git en cours de lecture…'
  }
  if (!context.isRepository) {
    return 'Aucun dépôt Git'
  }
  if (context.detachedHead) {
    return 'HEAD détachée'
  }
  return context.branch ? `Branche : ${context.branch}` : 'Aucune branche'
}

const copyText = (text: string, done: string): void => {
  void navigator.clipboard
    .writeText(text)
    .then(() => useHostStore.getState().setStatus(done))
    .catch(() => useHostStore.getState().setStatus('Copie dans le presse-papiers impossible.', StatusLevel.Error))
}

export const queryContext = (paneId: string): void => {
  const pane = paneById(paneId)
  if (pane) {
    bridge.send({ type: 'context.query', pane: paneId, path: pane.path })
  }
}

export const receiveContext = (paneId: string, path: string, git: GitContext): void => {
  useHostStore.getState().setContext(paneId, git)
  if (git.branch) {
    requestBranchMergeRequests(path, git.branch)
  }
  if (pendingBranchCopies.delete(paneId)) {
    copyBranchFrom(git, path)
  }
}

const copyBranchFrom = (git: GitContext, path: string): void => {
  if (git.branch) {
    copyText(git.branch, `Branche « ${git.branch} » copiée.`)
  } else {
    useHostStore.getState().setStatus(`${gitSummary(git)} dans ${path} : rien à copier.`, StatusLevel.Warning)
  }
}

export const copyPanePath = (paneId: string): void => {
  const pane = paneById(paneId)
  if (pane) {
    copyText(pane.path, `Chemin copié : ${pane.path}`)
  }
}

export const copyPaneBranch = (paneId: string): void => {
  const pane = paneById(paneId)
  if (!pane) {
    return
  }
  const known = useHostStore.getState().contexts[paneId]
  if (known) {
    copyBranchFrom(known, pane.path)
    return
  }
  pendingBranchCopies.add(paneId)
  queryContext(paneId)
}

export const openPaneFolder = (paneId: string, target: OpenTarget): void => {
  const pane = paneById(paneId)
  if (pane) {
    bridge.send({ type: 'context.open', pane: paneId, path: pane.path, target })
    useHostStore.getState().setStatus(`${target === OpenTarget.Editor ? 'Éditeur' : 'Explorateur'} ouvert sur ${pane.path}`)
  }
}
