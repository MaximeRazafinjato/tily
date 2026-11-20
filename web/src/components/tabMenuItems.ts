import { distinctWorkspaceName, type Session } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { useWindowStore } from '../store/windowStore'
import { copyPanePath } from '../terminal/contextActions'
import { mergeTabIntoTab, tabMergeTargets } from '../terminal/tabMerge'
import { attachTab, detachTab } from '../window/windowTransfer'
import type { ActionMenuItem } from './ActionMenu'

const copyTabPath = (session: Session | null, tabId: string): void => {
  const paneId = session?.workspaces.flatMap((workspace) => workspace.tabs).find((tab) => tab.id === tabId)?.active
  if (paneId) {
    copyPanePath(paneId)
  }
}

const windowItems = (tabId: string): ActionMenuItem[] => {
  const { detached, mainWorkspaces } = useWindowStore.getState()
  return [
    { id: 'detach', label: 'Détacher dans une nouvelle fenêtre', run: () => detachTab(tabId) },
    ...(detached
      ? [
          { id: 'attach', label: 'Rattacher à la fenêtre principale', run: () => attachTab(tabId) },
          ...mainWorkspaces.map((workspace) => ({ id: `attach-to-${workspace.id}`, label: `Rattacher à « ${workspace.name} »`, run: () => attachTab(tabId, workspace.id) })),
        ]
      : []),
  ]
}

export const tabTransferItems = (session: Session | null, tabId: string): ActionMenuItem[] => {
  const workspaces = session?.workspaces ?? []
  const source = workspaces.find((workspace) => workspace.tabs.some((tab) => tab.id === tabId))
  return [
    ...workspaces
      .filter((workspace) => workspace !== source)
      .map((workspace) => ({ id: `move-to-${workspace.id}`, label: `Déplacer vers « ${distinctWorkspaceName(workspaces, workspace)} »`, run: () => useSessionStore.getState().moveTab(tabId, workspace.id) })),
    ...(session ? tabMergeTargets(session, tabId, true) : []).map((target) => ({
      id: `merge-${target.placement}-${target.tab.id}`,
      label: `Fusionner dans « ${target.name} », ${target.placementLabel}`,
      run: () => mergeTabIntoTab(tabId, target.tab.id, target.placement),
    })),
    ...windowItems(tabId),
    { id: 'copy-path', label: 'Copier le chemin', run: () => copyTabPath(session, tabId) },
  ]
}
