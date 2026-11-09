import { bridge } from '../bridge/bridge'
import { PickTarget, type Project } from '../bridge/messages'
import type { WorktreeSources } from '../bridge/worktreeMessages'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { activeWorkspace, DEFAULT_SHELL, folderName } from '../model/session'
import { useHostStore } from '../store/hostStore'
import { useProjectOpenStore } from '../store/projectOpenStore'
import { useSessionStore } from '../store/sessionStore'
import { useUiStore } from '../store/uiStore'

export const PROJECT_REPOSITORY_FIELD = 'project-repository'
export const PROJECT_FOLDER_FIELD = 'project-folder'

const openFolder = (project: Project, path: string, inActiveWorkspace: boolean): void => {
  const { session, newWorkspace, newTabAt } = useSessionStore.getState()
  useUiStore.getState().closeProjectPicker()
  useProjectOpenStore.getState().setChoice(null)
  if (inActiveWorkspace && session && activeWorkspace(session)) {
    newTabAt(path, DEFAULT_SHELL)
  } else {
    newWorkspace(project.name, path, DEFAULT_SHELL)
  }
}

const pendingChoice = () => (useUiStore.getState().projectPickerOpen ? useProjectOpenStore.getState().choice : null)

export const openProjectPicker = (): void => {
  useProjectOpenStore.getState().setChoice(null)
  bridge.send({ type: 'projects.list' })
  useUiStore.getState().openProjectPicker()
}

export const closeProjectPicker = (): void => {
  useUiStore.getState().closeProjectPicker()
  useProjectOpenStore.getState().setChoice(null)
  focusActivePane()
}

export const selectProject = (project: Project, inActiveWorkspace: boolean): void => {
  if (project.worktree) {
    openFolder(project, project.path, inActiveWorkspace)
    return
  }
  const store = useProjectOpenStore.getState()
  const request = store.nextRequest()
  store.setChoice({ project, inActiveWorkspace, request, sources: null })
  bridge.send({ type: 'projects.repositories', request, project: project.path })
}

export const receiveProjectRepositories = (request: number, sources: WorktreeSources): void => {
  const choice = pendingChoice()
  if (!choice || choice.request !== request) {
    return
  }
  if (sources.repositories.length <= 1) {
    openFolder(choice.project, sources.selected ?? choice.project.path, choice.inActiveWorkspace)
  } else {
    useProjectOpenStore.getState().setChoice({ ...choice, sources })
  }
}

export const openProjectRepository = (repository: string, inActiveWorkspace: boolean, remember: boolean): void => {
  const choice = pendingChoice()
  if (!choice) {
    return
  }
  if (remember) {
    bridge.send({ type: 'projects.rememberRepository', project: choice.project.path, repository })
  }
  openFolder(choice.project, repository, inActiveWorkspace)
}

export const browseProjectRepository = (inActiveWorkspace: boolean, remember: boolean): void => {
  useProjectOpenStore.getState().setBrowse({ inActiveWorkspace, remember })
  bridge.send({ type: 'dialog.pick', field: PROJECT_REPOSITORY_FIELD, target: PickTarget.Folder })
}

export const receiveProjectRepositoryPicked = (path: string): void => {
  const { browse, setBrowse } = useProjectOpenStore.getState()
  setBrowse(null)
  if (browse) {
    openProjectRepository(path, browse.inActiveWorkspace, browse.remember)
  }
}

export const receiveProjectRepositoryRemembered = (project: string, repository: string): void =>
  useHostStore.getState().setStatus(`Dépôt par défaut du projet « ${folderName(project)} » : ${repository}`)

export const browseProjectFolder = (inActiveWorkspace: boolean): void => {
  useProjectOpenStore.getState().setBrowse({ inActiveWorkspace, remember: false })
  bridge.send({ type: 'dialog.pick', field: PROJECT_FOLDER_FIELD, target: PickTarget.Folder })
}

export const receiveProjectFolderPicked = (path: string): void => {
  const { browse, setBrowse } = useProjectOpenStore.getState()
  setBrowse(null)
  if (browse && useUiStore.getState().projectPickerOpen) {
    selectProject({ name: folderName(path), path, worktree: false }, browse.inActiveWorkspace)
  }
}
