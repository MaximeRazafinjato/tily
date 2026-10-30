import { bridge } from '../bridge/bridge'
import type { AppearanceCatalog, AppearanceState, FolderProject } from '../bridge/appearanceMessages'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { activePane, activeTab, type Session, type Workspace } from '../model/session'
import { useAppearanceStore, type ColorTarget } from '../store/appearanceStore'
import { useSessionStore } from '../store/sessionStore'
import { terminalRegistry } from '../terminal/terminalRegistry'

const TOKEN_PREFIX = '--color-tily-'
const PROJECT_COLOR_DELAY_MS = 300

const projectColorTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const workspacePath = (workspace: Workspace): string => activePane(activeTab(workspace)).path

const followedPaths = (session: Session | null): string[] => [...new Set((session?.workspaces ?? []).map(workspacePath))].sort()

export const receiveAppearance = (state: AppearanceState): void => {
  const root = document.documentElement.style
  Object.entries(state.theme.tokens).forEach(([token, color]) => root.setProperty(`${TOKEN_PREFIX}${token}`, color))
  terminalRegistry.setTheme(state.theme.terminal)
  useAppearanceStore.getState().setState(state)
}

export const receiveAppearanceCatalog = (catalog: AppearanceCatalog): void => {
  useAppearanceStore.getState().setAccentPresets(catalog.accentPresets)
  receiveAppearance(catalog.state)
}

export const receiveProjects = (projects: FolderProject[]): void => useAppearanceStore.getState().setProjects(projects)

export const startAppearanceProjects = (): (() => void) => {
  let sent: string | null = null
  return useSessionStore.subscribe((state) => {
    const paths = followedPaths(state.session)
    const key = paths.join('\n')
    if (key !== sent) {
      sent = key
      bridge.send({ type: 'appearance.projects', paths })
    }
  })
}

export const setWorkspaceColor = (workspaceId: string, color: string | undefined): void => useSessionStore.getState().setWorkspaceColor(workspaceId, color)

export const setTabColor = (tabId: string, color: string | undefined): void => useSessionStore.getState().setTabColor(tabId, color)

export const setProjectColor = (project: string, color: string | undefined): void => {
  useAppearanceStore.setState((store) => ({
    projects: Object.fromEntries(Object.entries(store.projects).map(([key, folder]) => [key, folder.project === project ? { ...folder, color } : folder])),
  }))
  clearTimeout(projectColorTimers.get(project))
  projectColorTimers.set(
    project,
    setTimeout(() => {
      projectColorTimers.delete(project)
      bridge.send({ type: 'appearance.projectColor', project, color })
    }, PROJECT_COLOR_DELAY_MS),
  )
}

export const openColorDialog = (target: ColorTarget): void => useAppearanceStore.getState().openColorDialog(target)

export const openTabColor = (tabId: string): void => {
  const workspace = useSessionStore.getState().session?.workspaces.find((candidate) => candidate.tabs.some((tab) => tab.id === tabId))
  if (workspace) {
    openColorDialog({ workspaceId: workspace.id, tabId })
  }
}

export const closeColorDialog = (): void => {
  useAppearanceStore.getState().closeColorDialog()
  focusActivePane()
}
