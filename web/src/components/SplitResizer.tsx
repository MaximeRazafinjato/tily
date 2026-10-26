import { useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { SPLIT_RATIO_DEFAULT, SPLIT_RATIO_MAX, SPLIT_RATIO_MIN, SplitAxis } from '../model/session'

const KEYBOARD_STEP = 0.05
const PERCENT = 100
const DECREASE_KEYS = new Set(['ArrowLeft', 'ArrowUp'])
const INCREASE_KEYS = new Set(['ArrowRight', 'ArrowDown'])

interface SplitResizerProps {
  axis: SplitAxis
  ratio: number
  containerRef: RefObject<HTMLDivElement | null>
  onResize: (ratio: number) => void
}

export function SplitResizer({ axis, ratio, containerRef, onResize }: SplitResizerProps) {
  const draggingRef = useRef(false)
  const horizontal = axis === SplitAxis.Horizontal
  const cursor = horizontal ? 'ew-resize' : 'ns-resize'

  const ratioAt = (event: PointerEvent<HTMLDivElement>): number | undefined => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) {
      return undefined
    }
    return horizontal ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height
  }
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    document.body.style.cursor = cursor
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const next = draggingRef.current ? ratioAt(event) : undefined
    if (next !== undefined) {
      onResize(next)
    }
  }
  const handlePointerUp = () => {
    draggingRef.current = false
    document.body.style.cursor = ''
  }
  const handleDoubleClick = () => onResize(SPLIT_RATIO_DEFAULT)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (DECREASE_KEYS.has(event.key) || INCREASE_KEYS.has(event.key)) {
      event.preventDefault()
      onResize(ratio + (INCREASE_KEYS.has(event.key) ? KEYBOARD_STEP : -KEYBOARD_STEP))
    }
  }

  return (
    <div
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label="Redimensionner les panes"
      data-tip="Redimensionner les panes"
      aria-valuemin={Math.round(SPLIT_RATIO_MIN * PERCENT)}
      aria-valuemax={Math.round(SPLIT_RATIO_MAX * PERCENT)}
      aria-valuenow={Math.round(ratio * PERCENT)}
      tabIndex={0}
      className={`group flex shrink-0 items-center justify-center focus-visible:outline-none ${horizontal ? 'w-2 cursor-ew-resize' : 'h-2 cursor-ns-resize'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`rounded bg-tily-line group-hover:bg-tily-green group-focus-visible:bg-tily-focus ${horizontal ? 'h-full w-px group-hover:w-0.5 group-focus-visible:w-0.5' : 'h-px w-full group-hover:h-0.5 group-focus-visible:h-0.5'}`}
      />
    </div>
  )
}
