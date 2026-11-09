import type { CSSProperties } from 'react'
import { PaneEdge } from '../model/session'
import { useUiStore } from '../store/uiStore'

const HALF = 2

const areaOf = (rect: DOMRect, edge: PaneEdge): CSSProperties => {
  const sideBySide = edge === PaneEdge.Left || edge === PaneEdge.Right
  return {
    left: edge === PaneEdge.Right ? rect.left + rect.width / HALF : rect.left,
    top: edge === PaneEdge.Bottom ? rect.top + rect.height / HALF : rect.top,
    width: sideBySide ? rect.width / HALF : rect.width,
    height: sideBySide ? rect.height : rect.height / HALF,
  }
}

export function PaneDropIndicator() {
  const target = useUiStore((state) => state.paneDropTarget)
  const pane = target ? document.querySelector<HTMLElement>(`[data-pane-id="${CSS.escape(target.paneId)}"]`) : null
  if (!target || !pane) {
    return null
  }

  return <div aria-hidden="true" className="pointer-events-none fixed z-40 rounded-md border-2 border-tily-green bg-tily-green/20" style={areaOf(pane.getBoundingClientRect(), target.edge)} />
}
