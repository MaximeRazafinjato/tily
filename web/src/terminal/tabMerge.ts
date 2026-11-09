import { activeTab, activeWorkspace, distinctTabName, distinctWorkspaceName, PaneEdge, panesOf, type Session, type Tab } from '../model/session'
import { useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { useTabMergePickerStore } from '../store/tabMergePickerStore'
import { useUiStore } from '../store/uiStore'
import { focusPane } from './terminalActions'

export enum MergePlacement {
  Beside = 'beside',
  Below = 'below',
}

export interface TabMergeTarget {
  tab: Tab
  name: string
  placement: MergePlacement
  placementLabel: string
}

const PLACEMENT_LABELS: Record<MergePlacement, string> = {
  [MergePlacement.Beside]: 'côte à côte',
  [MergePlacement.Below]: 'en dessous',
}

const PLACEMENT_EDGES: Record<MergePlacement, PaneEdge> = {
  [MergePlacement.Beside]: PaneEdge.Right,
  [MergePlacement.Below]: PaneEdge.Bottom,
}

const NO_TARGET_STATUS = 'Aucun autre onglet où fusionner l’onglet actif.'

const allTabs = (session: Session | null): Tab[] => session?.workspaces.flatMap((workspace) => workspace.tabs) ?? []

const tabOfPane = (session: Session | null, paneId: string): Tab | undefined => allTabs(session).find((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId))

export const tabMergeTargets = (session: Session, tabId: string, sameWorkspaceOnly = false): TabMergeTarget[] => {
  const source = session.workspaces.find((workspace) => workspace.tabs.some((tab) => tab.id === tabId))
  if (!source) {
    return []
  }
  const workspaces = sameWorkspaceOnly ? [source] : [source, ...session.workspaces.filter((workspace) => workspace !== source)]
  return workspaces.flatMap((workspace) =>
    workspace.tabs
      .filter((tab) => tab.id !== tabId)
      .flatMap((tab) => {
        const name = workspace === source ? distinctTabName(workspace, tab) : `${distinctWorkspaceName(session.workspaces, workspace)} / ${distinctTabName(workspace, tab)}`
        return Object.values(MergePlacement).map((placement) => ({ tab, name, placement, placementLabel: PLACEMENT_LABELS[placement] }))
      }),
  )
}

export const mergeTabIntoPane = (tabId: string, paneId: string, edge: PaneEdge): void => {
  const { session } = useSessionStore.getState()
  const source = allTabs(session).find((tab) => tab.id === tabId)
  const target = tabOfPane(session, paneId)
  if (!source || !target || source.id === target.id) {
    return
  }
  const { zoomedPaneId, clearPaneZoom } = useUiStore.getState()
  if (zoomedPaneId && [source, target].some((tab) => panesOf(tab.tree).some((pane) => pane.id === zoomedPaneId))) {
    clearPaneZoom()
  }
  useSessionStore.getState().moveTabIntoPane(tabId, paneId, edge)
  useHostStore.getState().setStatus(`Onglet « ${source.name} » fusionné dans « ${target.name} » : ses terminaux continuent de tourner.`)
  requestAnimationFrame(() => focusPane(source.active))
}

export const mergeTabIntoTab = (tabId: string, targetTabId: string, placement: MergePlacement): void => {
  const target = allTabs(useSessionStore.getState().session).find((tab) => tab.id === targetTabId)
  if (target) {
    mergeTabIntoPane(tabId, target.active, PLACEMENT_EDGES[placement])
  }
}

const currentTab = (): Tab | undefined => {
  const { session } = useSessionStore.getState()
  const workspace = session ? activeWorkspace(session) : undefined
  return workspace ? activeTab(workspace) : undefined
}

export const openTabMergePicker = (): void => {
  const { session } = useSessionStore.getState()
  const tab = currentTab()
  if (!session || !tab) {
    return
  }
  if (tabMergeTargets(session, tab.id).length === 0) {
    useHostStore.getState().setStatus(NO_TARGET_STATUS)
    return
  }
  useTabMergePickerStore.getState().setOpen(true)
}

export const closeTabMergePicker = (): void => {
  useTabMergePickerStore.getState().setOpen(false)
  const tab = currentTab()
  if (tab) {
    focusPane(tab.active)
  }
}

export const mergeActiveTabInto = (target: TabMergeTarget): void => {
  useTabMergePickerStore.getState().setOpen(false)
  const tab = currentTab()
  if (tab) {
    mergeTabIntoTab(tab.id, target.tab.id, target.placement)
  }
}
