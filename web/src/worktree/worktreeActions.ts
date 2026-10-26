import { bridge } from '../bridge/bridge'
import { CANCELLED_REPLY, dispatchReply, newAgentRequest } from '../bridge/requestListeners'
import { PickTarget } from '../bridge/messages'
import { WorktreeBranchMode, WorktreeOperation, type WorktreePlan, type WorktreeSources } from '../bridge/worktreeMessages'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { activePane, activeTab, activeWorkspace, createPane, DEFAULT_SHELL, panesOf, SplitAxis } from '../model/session'
import { useAgentStore } from '../store/agentStore'
import { useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { useWorktreeStore, WorktreePickerKind, type WorktreeDraft, type WorktreeRemoval, type WorktreeTask } from '../store/worktreeStore'
import { requestClose } from '../terminal/closeGuard'
import { joinPane } from '../terminal/terminalActions'
import { terminalRegistry } from '../terminal/terminalRegistry'
import { panesWithin, removalPanes, sameFolder, worktreeTarget } from './worktreePaths'

const PLAN_DELAY_MS = 250

export const WORKTREE_REPOSITORY_FIELD = 'worktree-repository'
export const WORKTREE_FOLDER_FIELD = 'worktree-folder'

let planTimer: ReturnType<typeof setTimeout> | undefined

type DraftPreset = Partial<Pick<WorktreeDraft, 'branch' | 'mode' | 'base'>>

const sendPlan = (request: number): void => {
  const { draft, planRequest } = useWorktreeStore.getState()
  if (!draft || request !== planRequest) {
    return
  }
  bridge.send({ type: 'worktrees.plan', request, repository: draft.repository, branch: draft.branch, mode: draft.mode, base: draft.base || undefined, project: draft.project, folder: draft.folder ?? undefined })
}

const schedulePlan = (delay: number): void => {
  clearTimeout(planTimer)
  const request = useWorktreeStore.getState().requestPlan()
  planTimer = setTimeout(() => sendPlan(request), delay)
}

const openDraft = (folder: string, preset: DraftPreset, source: { path: string } | { project: string }): void => {
  const { setPicker, setDraft, setCreateFailure, requestSources } = useWorktreeStore.getState()
  clearTimeout(planTimer)
  setPicker(null)
  setCreateFailure(null)
  setDraft({ project: folder, repository: '', remember: false, branch: '', mode: WorktreeBranchMode.New, base: '', folder: null, rememberFolder: false, install: true, claude: true, database: true, ...preset })
  bridge.send({ type: 'worktrees.sources', request: requestSources(), ...source })
}

export const openWorktreeDialog = (repository: string, preset: DraftPreset = {}): void => openDraft(repository, preset, { path: repository })

export const openProjectWorktreeDialog = (project: string): void => openDraft(project, {}, { project })

export const applyWorktreeSources = (request: number, sources: WorktreeSources): void => {
  const store = useWorktreeStore.getState()
  if (!store.receiveSources(request, sources) || !store.draft) {
    return
  }
  store.setDraft({ ...store.draft, project: sources.project, repository: sources.selected ?? sources.project })
  schedulePlan(0)
}

export const changeWorktreeDraft = (patch: Partial<WorktreeDraft>): void => {
  const { draft, sources, setDraft } = useWorktreeStore.getState()
  if (!draft) {
    return
  }
  setDraft({ ...draft, ...patch })
  if (sources && ('branch' in patch || 'mode' in patch || 'base' in patch || 'folder' in patch || 'repository' in patch)) {
    schedulePlan(PLAN_DELAY_MS)
  }
}

export const browseWorktreeRepository = (): void => bridge.send({ type: 'dialog.pick', field: WORKTREE_REPOSITORY_FIELD, target: PickTarget.Folder })

export const changeWorktreeFolder = (folder: string): void => changeWorktreeDraft({ folder, rememberFolder: true })

export const pickWorktreeFolder = (): void => bridge.send({ type: 'dialog.pick', field: WORKTREE_FOLDER_FIELD, target: PickTarget.Folder })

export const closeWorktreeDialog = (): void => {
  clearTimeout(planTimer)
  useWorktreeStore.getState().setDraft(null)
  focusActivePane()
}

export const folderChanged = (draft: WorktreeDraft, plan: WorktreePlan | null): boolean =>
  draft.folder !== null && draft.folder.trim().length > 0 && !sameFolder(draft.folder.trim(), plan?.defaultFolder ?? '')

const waitingLabel = (waiting: number): string => `${waiting} opération${waiting > 1 ? 's' : ''} de worktree avant`

export const queueWorktreeTask = (task: WorktreeTask, label: string): void => {
  const { tasks, addTask } = useWorktreeStore.getState()
  addTask(task)
  useHostStore.getState().setStatus(tasks.length > 0 ? `${label} en attente (${waitingLabel(tasks.length)}).` : `${label}…`)
}

export const dialogCreationPending = (tasks: WorktreeTask[]): boolean => tasks.some((task) => task.fromDialog)

export const submitWorktree = (): void => {
  const { draft, plan, planPending, tasks, setCreateFailure } = useWorktreeStore.getState()
  if (!draft || !plan?.path || plan.error || planPending || dialogCreationPending(tasks)) {
    return
  }
  setCreateFailure(null)
  const request = newAgentRequest()
  queueWorktreeTask({ request, operation: WorktreeOperation.Create, fromDialog: true }, 'Création du worktree')
  bridge.send({ type: 'worktrees.create', request, repository: draft.repository, branch: draft.branch, mode: draft.mode, base: draft.base || undefined, install: draft.install, claude: draft.claude, database: draft.database, project: draft.project, remember: draft.remember, folder: draft.folder ?? undefined, rememberFolder: draft.rememberFolder && folderChanged(draft, plan) })
}

export const openWorktreePicker = (kind: WorktreePickerKind): void => {
  bridge.send({ type: 'projects.list' })
  useWorktreeStore.getState().setPicker(kind)
}

export const closeWorktreePicker = (): void => {
  useWorktreeStore.getState().setPicker(null)
  focusActivePane()
}

export const startWorktreeCreation = (): void => {
  const { session } = useSessionStore.getState()
  const workspace = session ? activeWorkspace(session) : undefined
  const pane = workspace ? activePane(activeTab(workspace)) : undefined
  if (pane && useHostStore.getState().contexts[pane.id]?.isRepository) {
    openWorktreeDialog(pane.path)
  } else {
    openWorktreePicker(WorktreePickerKind.Source)
  }
}

export const openWorktree = (path: string, inActiveWorkspace = false): void => {
  const { session, newWorkspace, newTabAt } = useSessionStore.getState()
  const existing = session ? panesWithin(session, path)[0] : undefined
  if (existing) {
    joinPane(existing.id)
    return
  }
  if (inActiveWorkspace && session && activeWorkspace(session)) {
    newTabAt(path, DEFAULT_SHELL)
  } else {
    newWorkspace(worktreeTarget(path).name, path, DEFAULT_SHELL)
  }
}

const startBelow = (paneId: string, path: string, command: string): void => {
  const { insertPaneBeside, selectPane } = useSessionStore.getState()
  const pane = createPane(path, DEFAULT_SHELL)
  insertPaneBeside(paneId, SplitAxis.Vertical, pane)
  selectPane(paneId)
  terminalRegistry.runAtStart(pane.id, command)
}

export const openCreatedWorktree = (path: string, name: string, install: string | undefined, claude: string | undefined): void => {
  const { newWorkspace } = useSessionStore.getState()
  const workspaceId = newWorkspace(name, path, DEFAULT_SHELL)
  const workspace = useSessionStore.getState().session?.workspaces.find((candidate) => candidate.id === workspaceId)
  if (!workspace) {
    return
  }
  const paneId = activeTab(workspace).active
  if (claude) {
    terminalRegistry.runAtStart(paneId, claude)
  }
  if (install && claude) {
    startBelow(paneId, path, install)
  } else if (install) {
    terminalRegistry.runAtStart(paneId, install)
  }
}

type RemovalPreset = Partial<Pick<WorktreeRemoval, 'keepBranch' | 'dropDatabase' | 'request' | 'requestedBy'>>

export const requestWorktreeRemoval = (path: string, branch?: string, preset: RemovalPreset = {}): void => {
  const { session } = useSessionStore.getState()
  if (!session) {
    return
  }
  const panes = removalPanes(session, path, useAgentStore.getState().agents)
  useWorktreeStore.getState().setRemoval({ ...worktreeTarget(path), branch, panes, closePanes: true, keepBranch: false, dropDatabase: true, failure: null, ...preset })
}

const removalCancelled = (removal: WorktreeRemoval): void => {
  dispatchReply(CANCELLED_REPLY, removal.request, removal)
}

export const changeWorktreeRemoval = (patch: Partial<WorktreeRemoval>): void => {
  const { removal, setRemoval } = useWorktreeStore.getState()
  if (removal) {
    setRemoval({ ...removal, ...patch })
  }
}

export const cancelWorktreeRemoval = (): void => {
  const { removal, setRemoval } = useWorktreeStore.getState()
  setRemoval(null)
  focusActivePane()
  if (removal) {
    removalCancelled(removal)
  }
}

const closePanesNow = (paneIds: string[]): void => {
  const targets = new Set(paneIds)
  const { session, closeTab, closePane } = useSessionStore.getState()
  for (const tab of session?.workspaces.flatMap((workspace) => workspace.tabs) ?? []) {
    const panes = panesOf(tab.tree)
    if (panes.every((pane) => targets.has(pane.id))) {
      closeTab(tab.id)
    } else {
      panes.filter((pane) => targets.has(pane.id)).forEach((pane) => closePane(pane.id))
    }
  }
}

export const confirmWorktreeRemoval = (): void => {
  const { removal, setRemoval } = useWorktreeStore.getState()
  if (!removal) {
    return
  }
  setRemoval(null)
  const paneIds = removal.closePanes ? removal.panes.map((pane) => pane.paneId) : []
  requestClose(
    `Supprimer le worktree « ${removal.name} » ?`,
    paneIds,
    () => {
      closePanesNow(paneIds)
      const request = removal.request ?? newAgentRequest()
      const pending = { ...removal, panes: removal.closePanes ? [] : removal.panes, failure: null }
      queueWorktreeTask({ request, operation: WorktreeOperation.Remove, fromDialog: false, removal: pending }, `Suppression du worktree « ${removal.name} »`)
      bridge.send({ type: 'worktrees.remove', request, path: removal.path, keepBranch: removal.keepBranch, dropDatabase: removal.dropDatabase, confirmed: true })
    },
    undefined,
    () => removalCancelled(removal),
  )
}
