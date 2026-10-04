import { pageName, type BrowserViewport } from '../model/browser'
import { panesOf, splitLeaf, updatePane, type Pane, type Session, type SplitAxis } from '../model/session'

export const insertPaneBesideIn = (draft: Session, paneId: string, axis: SplitAxis, pane: Pane): void => {
  for (const workspace of draft.workspaces) {
    for (const tab of workspace.tabs) {
      if (panesOf(tab.tree).some((candidate) => candidate.id === paneId)) {
        tab.tree = splitLeaf(tab.tree, paneId, axis, pane)
        tab.active = pane.id
        workspace.active = tab.id
        draft.active = workspace.id
      }
    }
  }
}

export const setBrowserPageIn = (draft: Session, paneId: string, url: string, title: string): void => {
  for (const workspace of draft.workspaces) {
    for (const tab of workspace.tabs) {
      const pane = panesOf(tab.tree).find((candidate) => candidate.id === paneId)
      if (!pane) {
        continue
      }
      if (pane.url !== url) {
        tab.tree = updatePane(tab.tree, paneId, { url })
      }
      const name = pageName(url, title)
      if (!tab.manual && tab.active === paneId && tab.name !== name) {
        tab.name = name
      }
    }
  }
}

export const setPaneViewportIn = (draft: Session, paneId: string, viewport: BrowserViewport): void => {
  for (const workspace of draft.workspaces) {
    for (const tab of workspace.tabs) {
      if (panesOf(tab.tree).some((candidate) => candidate.id === paneId && candidate.viewport !== viewport)) {
        tab.tree = updatePane(tab.tree, paneId, { viewport })
      }
    }
  }
}
