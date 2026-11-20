import type { PointerEvent as ReactPointerEvent } from 'react'
import { paneName, panesOf } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { useUiStore } from '../store/uiStore'
import { trackOutsideDrag } from '../window/windowDrag'
import { detachPane } from '../window/windowTransfer'
import { trackPointerDrag } from './pointerDrag'
import { beginTabDrag, paneEdgeTargetAt, showDropTargets, tabDropTargetAt, trackSpring } from './tabDrag'

const BUTTON_SELECTOR = 'button, a, input'

export const beginPaneDrag = (event: ReactPointerEvent<HTMLElement>, paneId: string): void => {
  if (event.target instanceof Element && event.target.closest(BUTTON_SELECTOR)) {
    return
  }
  const store = useSessionStore.getState()
  const tab = store.session?.workspaces.flatMap((workspace) => workspace.tabs).find((candidate) => panesOf(candidate.tree).some((pane) => pane.id === paneId))
  const pane = tab ? panesOf(tab.tree).find((candidate) => candidate.id === paneId) : undefined
  if (!tab || !pane) {
    return
  }
  if (panesOf(tab.tree).length === 1) {
    beginTabDrag(event, tab.id, store.moveTab)
    return
  }
  let outside = false
  const outsideDrag = trackOutsideDrag(paneName(pane), true)
  const spring = trackSpring('')
  const isDraggedPane = (candidate: string): boolean => candidate === paneId
  trackPointerDrag(
    event,
    {
      start: () => useUiStore.getState().startDraggingPane(paneId),
      move: (x, y) => {
        outside = outsideDrag.move(x, y)
        const target = tabDropTargetAt(x, y)
        showDropTargets(target, target ? null : paneEdgeTargetAt(x, y, isDraggedPane))
        spring.follow(x, y)
      },
      end: (dropped) => {
        spring.cancel()
        outsideDrag.end()
        const { tabDropTarget, paneDropTarget, stopDraggingPane } = useUiStore.getState()
        stopDraggingPane()
        const { movePaneToTabAt, movePaneBeside } = useSessionStore.getState()
        if (dropped && tabDropTarget) {
          movePaneToTabAt(paneId, tabDropTarget.workspaceId, tabDropTarget.beforeTabId)
        } else if (dropped && paneDropTarget) {
          movePaneBeside(paneId, paneDropTarget.paneId, paneDropTarget.edge)
        } else if (dropped && outside) {
          detachPane(paneId, true)
        }
      },
    },
    { swallowClick: true },
  )
}
