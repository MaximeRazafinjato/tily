import { distinctWorkspaceName, type Session } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { copyPanePath } from '../terminal/contextActions'
import { mergeTabIntoTab, tabMergeTargets } from '../terminal/tabMerge'
import type { ActionMenuItem } from './ActionMenu'

const copyTabPath = (session: Session | null, tabId: string): void => {
  const paneId = session?.workspaces.flatMap((workspace) => workspace.tabs).find((tab) => tab.id === tabId)?.active
  if (paneId) {
    copyPanePath(paneId)
  }
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
    { id: 'copy-path', label: 'Copier le chemin', run: () => copyTabPath(session, tabId) },
  ]
}
