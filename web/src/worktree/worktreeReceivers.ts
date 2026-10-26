import { WorktreeOperation, type WorktreePlan } from '../bridge/worktreeMessages'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { useWorktreeStore } from '../store/worktreeStore'
import { formatCommandDuration } from '../terminal/commandNotices'
import { applyWorktreeSources, changeWorktreeDraft, changeWorktreeFolder, openCreatedWorktree } from './worktreeActions'

export const receiveWorktreeSources = applyWorktreeSources

export const receiveWorktreeRepositoryPicked = (path: string): void => changeWorktreeDraft({ repository: path })

export const receiveWorktreeFolderPicked = (path: string): void => changeWorktreeFolder(path)

export const receiveWorktreePlan = (request: number, plan: WorktreePlan): void => useWorktreeStore.getState().receivePlan(request, plan)

export const receiveWorktreeProgress = (message: string): void => {
  const { status, setStatus } = useHostStore.getState()
  if (status.text !== message) {
    setStatus(message)
  }
}

const createdStatus = (name: string, install: string | undefined, claude: string | undefined): string => {
  const opened = `Worktree « ${name} » ouvert${claude ? ' avec Claude Code' : ''}`
  return install ? `${opened} : ${install} tourne ${claude ? 'dans le pane du dessous' : 'dans son terminal'}.` : `${opened}.`
}

export const receiveWorktreeCreated = (path: string, name: string, install: string | undefined, claude: string | undefined): void => {
  useWorktreeStore.getState().setDraft(null)
  openCreatedWorktree(path, name, install, claude)
  useHostStore.getState().setStatus(createdStatus(name, install, claude))
}

export const receiveWorktreeDone = (request: number | undefined, message: string, warnings: string[]): void => {
  useWorktreeStore.getState().takeTask(request)
  const warned = warnings.length > 0
  useHostStore.getState().setStatus(warned ? `${message} ${warnings.join(' ')}` : message, warned ? StatusLevel.Warning : StatusLevel.Info)
}

export const receiveWorktreeFailed = (request: number | undefined, operation: WorktreeOperation, message: string, output: string | undefined, lockedBy: string[] | undefined): void => {
  const store = useWorktreeStore.getState()
  const task = store.takeTask(request)
  const failure = { message, output, lockedBy }
  if (task?.removal && !store.removal) {
    store.setRemoval({ ...task.removal, failure })
  } else if (operation === WorktreeOperation.Create && task?.fromDialog && store.draft) {
    store.setCreateFailure(failure)
  }
  useHostStore.getState().setStatus(message, StatusLevel.Error)
}

export const receiveWorktreePurging = (name: string, files: number, elapsedMs: number): void => useWorktreeStore.getState().setPurge({ name, files, elapsedMs })

const filesLabel = (files: number): string => `${files.toLocaleString('fr-FR')} fichier${files > 1 ? 's' : ''}`

export const receiveWorktreePurged = (names: string[], files: number, elapsedMs: number, remaining: string[]): void => {
  const store = useWorktreeStore.getState()
  const shown = store.purge !== null
  store.setPurge(null)
  const worktrees = names.map((name) => `« ${name} »`).join(', ')
  if (remaining.length > 0) {
    useHostStore.getState().setStatus(`Fichiers de ${worktrees} effacés en partie : supprimez à la main ${remaining.join(', ')}.`, StatusLevel.Warning)
  } else if (shown) {
    useHostStore.getState().setStatus(`Fichiers de ${worktrees} effacés : ${filesLabel(files)} en ${formatCommandDuration(elapsedMs)}.`)
  }
}
