import { bridge } from '../bridge/bridge'
import { PickTarget } from '../bridge/messages'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { activeTab, activeWorkspace, DEFAULT_SHELL } from '../model/session'
import { cloneFromDialogPending, useCloneStore, type CloneDraft } from '../store/cloneStore'
import { useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { useUiStore } from '../store/uiStore'
import { startInPane } from '../worktree/worktreeActions'

const PLAN_DELAY_MS = 250
const CLIPBOARD_MAX_LENGTH = 2048

export const CLONE_FOLDER_FIELD = 'clone-folder'

let planTimer: ReturnType<typeof setTimeout> | undefined

const sendPlan = (request: number): void => {
  const { draft, planRequest } = useCloneStore.getState()
  if (draft && request === planRequest) {
    bridge.send({ type: 'clone.plan', request, url: draft.url, folder: draft.folder ?? undefined, name: draft.name || undefined })
  }
}

const schedulePlan = (delay: number): void => {
  clearTimeout(planTimer)
  const request = useCloneStore.getState().requestPlan()
  planTimer = setTimeout(() => sendPlan(request), delay)
}

const suggestFromClipboard = (request: number): void => {
  navigator.clipboard.readText().then(
    (text) => {
      const { draft, suggestRequest } = useCloneStore.getState()
      if (draft && draft.url === '' && request === suggestRequest && text.trim() && text.length <= CLIPBOARD_MAX_LENGTH) {
        bridge.send({ type: 'clone.suggest', request, url: text })
      }
    },
    () => undefined,
  )
}

export const openCloneDialog = (folder?: string): void => {
  const store = useCloneStore.getState()
  clearTimeout(planTimer)
  store.setFailure(null)
  store.setDraft({ url: '', folder: folder ?? null, name: '', install: false, claude: false })
  schedulePlan(0)
  suggestFromClipboard(store.requestSuggestion())
}

export const cloneFromProjectPicker = (): void => {
  useUiStore.getState().closeProjectPicker()
  openCloneDialog()
}

export const changeCloneDraft = (patch: Partial<CloneDraft>): void => {
  const { draft, setDraft } = useCloneStore.getState()
  if (!draft) {
    return
  }
  setDraft({ ...draft, ...patch })
  if ('url' in patch || 'folder' in patch || 'name' in patch) {
    schedulePlan(PLAN_DELAY_MS)
  }
}

export const pickCloneFolder = (): void => bridge.send({ type: 'dialog.pick', field: CLONE_FOLDER_FIELD, target: PickTarget.Folder })

export const closeCloneDialog = (): void => {
  clearTimeout(planTimer)
  const store = useCloneStore.getState()
  store.detachTasks()
  store.setDraft(null)
  focusActivePane()
}

export const submitClone = (inActiveWorkspace: boolean): void => {
  const { draft, plan, planPending, tasks, setFailure, nextRequest, addTask } = useCloneStore.getState()
  if (!draft || !plan?.path || plan.error || planPending || cloneFromDialogPending(tasks)) {
    return
  }
  setFailure(null)
  const request = nextRequest()
  addTask({ request, inActiveWorkspace, fromDialog: true })
  useHostStore.getState().setStatus(`Clonage de « ${plan.name} »…`)
  bridge.send({ type: 'clone.start', request, url: draft.url, folder: draft.folder ?? undefined, name: draft.name || undefined, install: draft.install, claude: draft.claude })
}

const openedPane = (path: string, name: string, inActiveWorkspace: boolean): string | undefined => {
  const { session, newWorkspace, newTabAt } = useSessionStore.getState()
  if (inActiveWorkspace && session && activeWorkspace(session)) {
    newTabAt(path, DEFAULT_SHELL)
  } else {
    newWorkspace(name, path, DEFAULT_SHELL)
  }
  const current = useSessionStore.getState().session
  const opened = current ? activeWorkspace(current) : undefined
  return opened ? activeTab(opened).active : undefined
}

export const openClonedRepository = (path: string, name: string, inActiveWorkspace: boolean, install: string | undefined, claude: string | undefined): void => {
  const paneId = openedPane(path, name, inActiveWorkspace)
  if (paneId) {
    startInPane(paneId, path, install, claude)
  }
}
