import { current } from 'immer'
import { findWorkspace, insertBeside, mergedNote, panesOf, pruneNode, splitLeaf, SplitAxis, tabNameFor, tabOfPane, type Pane, type PaneEdge, type Session, type SplitNode, type Tab, type Workspace } from '../model/session'

export const keepRemaining = (source: Tab, paneId: string, remaining: SplitNode): void => {
  source.tree = remaining
  if (source.active === paneId) {
    const next = panesOf(remaining)[0]
    source.active = next.id
    source.name = tabNameFor(source, next.id, next.path)
  }
}

interface PaneLocation {
  workspace: Workspace
  tab: Tab
  pane: Pane
}

const locatePane = (draft: Session, paneId: string): PaneLocation | undefined => {
  for (const workspace of draft.workspaces) {
    for (const tab of workspace.tabs) {
      const pane = panesOf(tab.tree).find((candidate) => candidate.id === paneId)
      if (pane) {
        return { workspace, tab, pane }
      }
    }
  }
  return undefined
}

export const movePaneBeside = (draft: Session, paneId: string, targetPaneId: string, edge: PaneEdge): void => {
  const source = locatePane(draft, paneId)
  const target = locatePane(draft, targetPaneId)
  const remaining = source ? pruneNode(source.tab.tree, paneId) : null
  if (!source || !target || !remaining || paneId === targetPaneId) {
    return
  }
  const moved = current(source.pane)
  keepRemaining(source.tab, paneId, remaining)
  target.tab.tree = insertBeside(target.tab.tree, targetPaneId, edge, { pane: moved })
  target.tab.active = moved.id
  target.workspace.active = target.tab.id
  draft.active = target.workspace.id
}

export const movePaneToTabAt = (draft: Session, paneId: string, workspaceId: string, beforeTabId?: string): void => {
  const source = locatePane(draft, paneId)
  const workspace = findWorkspace(draft, workspaceId)
  const remaining = source ? pruneNode(source.tab.tree, paneId) : null
  if (!source || !workspace || !remaining) {
    return
  }
  const tab = tabOfPane(current(source.pane))
  keepRemaining(source.tab, paneId, remaining)
  const index = beforeTabId ? workspace.tabs.findIndex((candidate) => candidate.id === beforeTabId) : -1
  workspace.tabs.splice(index < 0 ? workspace.tabs.length : index, 0, tab)
  workspace.active = tab.id
  draft.active = workspace.id
}

export const takePane = (draft: Session, paneId: string): void => {
  const source = locatePane(draft, paneId)
  const remaining = source ? pruneNode(source.tab.tree, paneId) : null
  if (source && remaining) {
    keepRemaining(source.tab, paneId, remaining)
  }
}

export const movePaneOut = (draft: Session, paneId: string): void => {
  const workspace = draft.workspaces.find((candidate) => candidate.tabs.some((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId)))
  const index = workspace ? workspace.tabs.findIndex((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId)) : -1
  const source = workspace?.tabs[index]
  const remaining = source ? pruneNode(source.tree, paneId) : null
  const pane = source ? panesOf(source.tree).find((candidate) => candidate.id === paneId) : undefined
  if (!workspace || !source || !remaining || !pane) {
    return
  }
  const tab = tabOfPane(current(pane))
  keepRemaining(source, paneId, remaining)
  workspace.tabs.splice(index + 1, 0, tab)
  workspace.active = tab.id
  draft.active = workspace.id
}

export const movePaneInto = (draft: Session, paneId: string, targetTabId: string): void => {
  const workspace = draft.workspaces.find((candidate) => candidate.tabs.some((tab) => tab.id === targetTabId))
  const sourceWorkspace = draft.workspaces.find((candidate) => candidate.tabs.some((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId)))
  const source = sourceWorkspace?.tabs.find((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId))
  const target = workspace?.tabs.find((tab) => tab.id === targetTabId)
  const pane = source ? panesOf(source.tree).find((candidate) => candidate.id === paneId) : undefined
  const remaining = source ? pruneNode(source.tree, paneId) : null
  if (!workspace || !sourceWorkspace || !source || !target || !pane || source.id === target.id || (!remaining && sourceWorkspace.tabs.length === 1)) {
    return
  }
  const moved = current(pane)
  if (remaining) {
    keepRemaining(source, paneId, remaining)
  } else {
    const index = sourceWorkspace.tabs.findIndex((tab) => tab.id === source.id)
    sourceWorkspace.tabs = sourceWorkspace.tabs.filter((tab) => tab.id !== source.id)
    if (sourceWorkspace.active === source.id) {
      sourceWorkspace.active = sourceWorkspace.tabs[Math.min(index, sourceWorkspace.tabs.length - 1)].id
    }
  }
  target.tree = splitLeaf(target.tree, target.active, SplitAxis.Horizontal, moved)
  target.active = moved.id
  workspace.active = target.id
  draft.active = workspace.id
}

const removeMergedTab = (draft: Session, workspace: Workspace, tabId: string, destination: Workspace): void => {
  const index = workspace.tabs.findIndex((tab) => tab.id === tabId)
  workspace.tabs.splice(index, 1)
  if (workspace.tabs.length === 0) {
    if (workspace.note && !workspace.linkedNote) {
      destination.note = mergedNote(destination.note, workspace.name, workspace.note)
    }
    draft.workspaces = draft.workspaces.filter((candidate) => candidate !== workspace)
  } else if (workspace.active === tabId) {
    workspace.active = workspace.tabs[Math.min(index, workspace.tabs.length - 1)].id
  }
}

export const moveTabInto = (draft: Session, tabId: string, paneId: string, edge: PaneEdge): void => {
  const sourceWorkspace = draft.workspaces.find((candidate) => candidate.tabs.some((tab) => tab.id === tabId))
  const source = sourceWorkspace?.tabs.find((tab) => tab.id === tabId)
  const workspace = draft.workspaces.find((candidate) => candidate.tabs.some((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId)))
  const target = workspace?.tabs.find((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId))
  if (!sourceWorkspace || !source || !workspace || !target || source.id === target.id) {
    return
  }
  const moved = current(source)
  removeMergedTab(draft, sourceWorkspace, tabId, workspace)
  target.tree = insertBeside(target.tree, paneId, edge, moved.tree)
  target.active = moved.active
  workspace.active = target.id
  draft.active = workspace.id
}
