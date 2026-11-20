import { bridge } from '../bridge/bridge'
import { TransferDropKind, type TransferDrop } from '../bridge/windowMessages'
import { paneDropTargetAt, tabDropTargetAt } from '../components/tabDrag'
import { workspaceDropTargetAt } from '../components/workspaceDrag'
import { useUiStore } from '../store/uiStore'
import { isOutsideWindow } from './windowTransfer'

export const EXTERNAL_DRAG_ID = 'external-drag'
const OUTSIDE_TARGET = '__outside__'

export interface OutsideDragTracker {
  move: (x: number, y: number) => boolean
  end: () => void
}

let lastExternalDrop = ''

export const transferDropAt = (single: boolean, x: number, y: number, movedTabId = OUTSIDE_TARGET): TransferDrop | null => {
  if (single) {
    const tabTarget = tabDropTargetAt(x, y)
    if (tabTarget) {
      return { kind: TransferDropKind.Tab, ...tabTarget }
    }
    const paneTarget = paneDropTargetAt(x, y, movedTabId)
    if (paneTarget) {
      return { kind: TransferDropKind.Pane, ...paneTarget }
    }
  }
  const workspaceTarget = workspaceDropTargetAt(x, y)
  return workspaceTarget ? { kind: TransferDropKind.Workspace, ...workspaceTarget } : null
}

export const trackOutsideDrag = (name: string, single: boolean): OutsideDragTracker => {
  let outside = false
  return {
    move: (x, y) => {
      const now = isOutsideWindow(x, y)
      if (now) {
        bridge.send({ type: 'window.dragMove', name, single })
      } else if (outside) {
        bridge.send({ type: 'window.dragEnd' })
      }
      outside = now
      return now
    },
    end: () => {
      if (outside) {
        bridge.send({ type: 'window.dragEnd' })
      }
    },
  }
}

export const receiveDragOver = (x: number, y: number, single: boolean): void => {
  const drop = transferDropAt(single, x, y)
  const key = JSON.stringify(drop)
  const ui = useUiStore.getState()
  if (ui.draggingTabId === EXTERNAL_DRAG_ID && key === lastExternalDrop) {
    return
  }
  lastExternalDrop = key
  if (ui.draggingTabId !== EXTERNAL_DRAG_ID) {
    ui.startDraggingTab(EXTERNAL_DRAG_ID)
  }
  if (ui.draggingWorkspaceId !== EXTERNAL_DRAG_ID) {
    ui.startDraggingWorkspace(EXTERNAL_DRAG_ID)
  }
  ui.setTabDropTarget(drop?.kind === TransferDropKind.Tab && drop.workspaceId ? { workspaceId: drop.workspaceId, beforeTabId: drop.beforeTabId } : null)
  ui.setPaneDropTarget(drop?.kind === TransferDropKind.Pane && drop.paneId && drop.edge ? { paneId: drop.paneId, edge: drop.edge } : null)
  ui.setWorkspaceDropTarget(drop?.kind === TransferDropKind.Workspace ? { beforeWorkspaceId: drop.beforeWorkspaceId } : null)
}

export const receiveDragLeave = (): void => {
  lastExternalDrop = ''
  const ui = useUiStore.getState()
  if (ui.draggingTabId === EXTERNAL_DRAG_ID) {
    ui.stopDraggingTab()
  }
  if (ui.draggingWorkspaceId === EXTERNAL_DRAG_ID) {
    ui.stopDraggingWorkspace()
  }
}
