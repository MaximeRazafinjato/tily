import type { PointerEvent as ReactPointerEvent } from 'react'
import { PaneEdge, panesOf } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { useUiStore, type PaneDropTarget, type TabDropTarget } from '../store/uiStore'
import { mergeTabIntoPane } from '../terminal/tabMerge'
import { trackPointerDrag } from './pointerDrag'

const SPRING_DELAY_MS = 600
const PANE_SELECTOR = '[data-pane-id]'

export type MoveTabHandler = (tabId: string, workspaceId: string, beforeTabId?: string) => void

interface SpringTarget {
  key: string
  open: () => void
}

const dropTargetAt = (x: number, y: number): TabDropTarget | null => {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-workspace]')
  if (!element?.dataset.dropWorkspace) {
    return null
  }
  return { workspaceId: element.dataset.dropWorkspace, beforeTabId: element.dataset.dropTab }
}

const nearestEdge = (rect: DOMRect, x: number, y: number): PaneEdge => {
  const distances: [PaneEdge, number][] = [
    [PaneEdge.Left, (x - rect.left) / rect.width],
    [PaneEdge.Right, (rect.right - x) / rect.width],
    [PaneEdge.Top, (y - rect.top) / rect.height],
    [PaneEdge.Bottom, (rect.bottom - y) / rect.height],
  ]
  return distances.reduce((nearest, candidate) => (candidate[1] < nearest[1] ? candidate : nearest))[0]
}

const ownsPane = (tabId: string, paneId: string): boolean =>
  useSessionStore.getState().session?.workspaces.some((workspace) => workspace.tabs.some((tab) => tab.id === tabId && panesOf(tab.tree).some((pane) => pane.id === paneId))) ?? false

const paneDropTargetAt = (x: number, y: number, tabId: string): PaneDropTarget | null => {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>(PANE_SELECTOR)
  const paneId = element?.dataset.paneId
  if (!element || !paneId || ownsPane(tabId, paneId)) {
    return null
  }
  return { paneId, edge: nearestEdge(element.getBoundingClientRect(), x, y) }
}

const showTab = (tabId: string): void => {
  const { session, selectWorkspace, selectTab } = useSessionStore.getState()
  const workspace = session?.workspaces.find((candidate) => candidate.tabs.some((tab) => tab.id === tabId))
  if (workspace) {
    selectWorkspace(workspace.id)
    selectTab(tabId)
  }
}

const springTargetAt = (x: number, y: number, draggedTabId: string): SpringTarget | undefined => {
  const element = document.elementFromPoint(x, y)
  const tabId = element?.closest<HTMLElement>('[data-drop-tab]')?.dataset.dropTab
  if (tabId) {
    return tabId === draggedTabId ? undefined : { key: tabId, open: () => showTab(tabId) }
  }
  const workspaceId = element?.closest<HTMLElement>('[data-spring-workspace]')?.dataset.springWorkspace
  return workspaceId ? { key: workspaceId, open: () => useUiStore.getState().openSpringWorkspace(workspaceId) } : undefined
}

export const isDropTarget = (target: TabDropTarget | null, workspaceId: string, beforeTabId?: string): boolean =>
  target !== null && target.workspaceId === workspaceId && target.beforeTabId === beforeTabId

const sameDropTarget = (left: TabDropTarget | null, right: TabDropTarget | null): boolean =>
  left === right || (left !== null && right !== null && isDropTarget(left, right.workspaceId, right.beforeTabId))

const samePaneDropTarget = (left: PaneDropTarget | null, right: PaneDropTarget | null): boolean =>
  left === right || (left !== null && right !== null && left.paneId === right.paneId && left.edge === right.edge)

export const beginTabDrag = (event: ReactPointerEvent<HTMLElement>, tabId: string, onMove: MoveTabHandler): void => {
  let springCandidate: string | undefined
  let springTimer: ReturnType<typeof setTimeout> | undefined

  const followSpringCandidate = (x: number, y: number) => {
    const candidate = springTargetAt(x, y, tabId)
    if (candidate?.key === springCandidate) {
      return
    }
    springCandidate = candidate?.key
    clearTimeout(springTimer)
    if (candidate) {
      springTimer = setTimeout(candidate.open, SPRING_DELAY_MS)
    }
  }
  trackPointerDrag(event, {
    start: () => useUiStore.getState().startDraggingTab(tabId),
    move: (x, y) => {
      const target = dropTargetAt(x, y)
      const paneTarget = target ? null : paneDropTargetAt(x, y, tabId)
      const { tabDropTarget, paneDropTarget, setTabDropTarget, setPaneDropTarget } = useUiStore.getState()
      if (!sameDropTarget(tabDropTarget, target)) {
        setTabDropTarget(target)
      }
      if (!samePaneDropTarget(paneDropTarget, paneTarget)) {
        setPaneDropTarget(paneTarget)
      }
      followSpringCandidate(x, y)
    },
    end: (dropped) => {
      clearTimeout(springTimer)
      const { tabDropTarget, paneDropTarget, stopDraggingTab } = useUiStore.getState()
      stopDraggingTab()
      if (dropped && tabDropTarget) {
        onMove(tabId, tabDropTarget.workspaceId, tabDropTarget.beforeTabId)
      } else if (dropped && paneDropTarget) {
        mergeTabIntoPane(tabId, paneDropTarget.paneId, paneDropTarget.edge)
      }
    },
  })
}
