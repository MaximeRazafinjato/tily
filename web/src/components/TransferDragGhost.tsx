import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { allPanes, paneName } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { useUiStore } from '../store/uiStore'
import { useWindowStore } from '../store/windowStore'
import { EXTERNAL_DRAG_ID } from '../window/windowDrag'
import { isOutsideWindow } from '../window/windowTransfer'

const POINTER_OFFSET_X = 14
const POINTER_OFFSET_Y = 12
const DETACH_HINT = 'Lâchez hors de la fenêtre pour l’ouvrir dans une nouvelle fenêtre'
const ATTACH_HINT = ', ou sur la fenêtre principale pour l’y rattacher'

interface PointerPosition {
  x: number
  y: number
}

const draggedName = (tabId: string | null, workspaceId: string | null, paneId: string | null): string | null => {
  const { session } = useSessionStore.getState()
  const workspaces = session?.workspaces ?? []
  if (paneId && session) {
    const pane = allPanes(session).find((candidate) => candidate.id === paneId)
    return pane ? `Pane « ${paneName(pane)} »` : null
  }
  if (tabId && tabId !== EXTERNAL_DRAG_ID) {
    return workspaces.flatMap((workspace) => workspace.tabs).find((tab) => tab.id === tabId)?.name ?? null
  }
  if (workspaceId && workspaceId !== EXTERNAL_DRAG_ID) {
    const workspace = workspaces.find((candidate) => candidate.id === workspaceId)
    return workspace ? `Workspace « ${workspace.name} »` : null
  }
  return null
}

export function TransferDragGhost() {
  const { name, targeted } = useUiStore(
    useShallow((state) => ({
      name: draggedName(state.draggingTabId, state.draggingWorkspaceId, state.draggingPaneId),
      targeted: state.tabDropTarget !== null || state.paneDropTarget !== null || state.workspaceDropTarget !== null,
    })),
  )
  const detached = useWindowStore((state) => state.detached)
  const [pointer, setPointer] = useState<PointerPosition | null>(null)

  useEffect(() => {
    if (!name) {
      return
    }
    const handlePointerMove = (event: PointerEvent) => setPointer({ x: event.clientX, y: event.clientY })
    window.addEventListener('pointermove', handlePointerMove)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      setPointer(null)
    }
  }, [name])

  if (!name) {
    return null
  }
  const hint = `${DETACH_HINT}${detached ? ATTACH_HINT : ''}.`

  return (
    <div aria-hidden="true" className="pointer-events-none">
      {pointer && !isOutsideWindow(pointer.x, pointer.y) && (
        <div
          className="fixed z-50 flex max-w-[320px] flex-col rounded-md border border-tily-line bg-tily-paper px-[10px] py-[4px] shadow-lg"
          style={{ left: pointer.x + POINTER_OFFSET_X, top: pointer.y + POINTER_OFFSET_Y }}
        >
          <span className="truncate text-[12px] font-semibold text-tily-ink">{name}</span>
          {!targeted && <span className="text-[11px] text-tily-muted">Nouvelle fenêtre en la lâchant dehors</span>}
        </div>
      )}
      <div className="fixed bottom-[34px] left-1/2 z-50 -translate-x-1/2 rounded-md border border-tily-focus bg-tily-panel px-[12px] py-[6px] text-[12px] text-tily-ink shadow-lg">{hint}</div>
    </div>
  )
}
