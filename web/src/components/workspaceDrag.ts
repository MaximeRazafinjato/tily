import type { PointerEvent as ReactPointerEvent } from 'react'
import { useUiStore, type WorkspaceDropTarget } from '../store/uiStore'
import { useSessionStore } from '../store/sessionStore'
import { trackOutsideDrag } from '../window/windowDrag'
import { detachWorkspace } from '../window/windowTransfer'
import { trackPointerDrag } from './pointerDrag'

const LIST_SELECTOR = '[data-workspace-list]'
const SLOT_SELECTOR = '[data-workspace-slot]'
const HALF = 2

export type MoveWorkspaceHandler = (workspaceId: string, beforeWorkspaceId?: string) => void

export const workspaceDropTargetAt = (x: number, y: number): WorkspaceDropTarget | null => {
  const list = document.elementFromPoint(x, y)?.closest<HTMLElement>(LIST_SELECTOR)
  if (!list) {
    return null
  }
  const before = Array.from(list.querySelectorAll<HTMLElement>(SLOT_SELECTOR)).find((slot) => {
    const { top, height } = slot.getBoundingClientRect()
    return y < top + height / HALF
  })
  return { beforeWorkspaceId: before?.dataset.workspaceSlot }
}

const sameDropTarget = (left: WorkspaceDropTarget | null, right: WorkspaceDropTarget | null): boolean =>
  left === right || (left !== null && right !== null && left.beforeWorkspaceId === right.beforeWorkspaceId)

export const isWorkspaceDropTarget = (target: WorkspaceDropTarget | null, beforeWorkspaceId?: string): boolean =>
  target !== null && target.beforeWorkspaceId === beforeWorkspaceId

export const beginWorkspaceDrag = (event: ReactPointerEvent<HTMLElement>, workspaceId: string, onMove: MoveWorkspaceHandler): void => {
  let outside = false
  const workspace = useSessionStore.getState().session?.workspaces.find((candidate) => candidate.id === workspaceId)
  const outsideDrag = trackOutsideDrag(`Workspace « ${workspace?.name ?? ''} »`, workspace?.tabs.length === 1)
  trackPointerDrag(
    event,
    {
      start: () => useUiStore.getState().startDraggingWorkspace(workspaceId),
      move: (x, y) => {
        outside = outsideDrag.move(x, y)
        const target = workspaceDropTargetAt(x, y)
        const { workspaceDropTarget, setWorkspaceDropTarget } = useUiStore.getState()
        if (!sameDropTarget(workspaceDropTarget, target)) {
          setWorkspaceDropTarget(target)
        }
      },
      end: (dropped) => {
        outsideDrag.end()
        const { workspaceDropTarget, stopDraggingWorkspace } = useUiStore.getState()
        stopDraggingWorkspace()
        if (dropped && workspaceDropTarget) {
          onMove(workspaceId, workspaceDropTarget.beforeWorkspaceId)
        } else if (dropped && outside) {
          detachWorkspace(workspaceId, true)
        }
      },
    },
    { swallowClick: true },
  )
}
