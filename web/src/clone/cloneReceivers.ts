import type { ClonePlan } from '../bridge/cloneMessages'
import { useCloneStore } from '../store/cloneStore'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { changeCloneDraft, openClonedRepository } from './cloneActions'

export const receiveClonePlan = (request: number, plan: ClonePlan, roots: string[]): void => useCloneStore.getState().receivePlan(request, plan, roots)

export const receiveCloneSuggestion = (request: number, address: string | undefined): void => {
  const { draft, suggestRequest } = useCloneStore.getState()
  if (address && draft?.url === '' && request === suggestRequest) {
    changeCloneDraft({ url: address })
  }
}

export const receiveCloneFolderPicked = (path: string): void => changeCloneDraft({ folder: path })

export const receiveCloneProgress = (message: string): void => useCloneStore.getState().setProgress(message)

const startedStatus = (install: string | undefined, claude: string | undefined): string => {
  const agent = claude ? ' Claude Code démarre dans son terminal.' : ''
  return install ? `${agent} ${install} tourne ${claude ? 'dans le pane du dessous' : 'dans son terminal'}.` : agent
}

export const receiveCloneDone = (request: number, path: string, name: string, install: string | undefined, claude: string | undefined, message: string): void => {
  const store = useCloneStore.getState()
  const task = store.takeTask(request)
  store.setProgress(null)
  if (task?.fromDialog) {
    store.setDraft(null)
  }
  openClonedRepository(path, name, task?.inActiveWorkspace ?? false, install, claude)
  useHostStore.getState().setStatus(`${message}${startedStatus(install, claude)}`)
}

export const receiveCloneFailed = (request: number, message: string, output: string | undefined): void => {
  const store = useCloneStore.getState()
  const task = store.takeTask(request)
  store.setProgress(null)
  if (task?.fromDialog && store.draft) {
    store.setFailure({ message, output })
  }
  useHostStore.getState().setStatus(message, StatusLevel.Error)
}
