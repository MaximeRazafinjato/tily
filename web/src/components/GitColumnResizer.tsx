import { useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { GIT_COLUMN_MAX, GIT_COLUMN_MIN } from '../model/session'
import { ResizerSide } from './gitGraphStyles'

interface GitColumnResizerProps {
  side: ResizerSide
  width: number
  defaultWidth: number
  label: string
  narrowed: boolean
  onResize: (width: number) => void
}

const KEYBOARD_STEP = 10
const TABBABLE = 0
const UNTABBABLE = -1
const NARROWED_TIP = 'Colonne resserrée faute de place'

const stopClick = (event: MouseEvent) => event.stopPropagation()

export function GitColumnResizer({ side, width, defaultWidth, label, narrowed, onResize }: GitColumnResizerProps) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const direction = side === ResizerSide.Right ? 1 : -1

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (narrowed) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startX: event.clientX, startWidth: width }
    document.body.style.cursor = 'ew-resize'
  }
  const handlePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (dragRef.current) {
      onResize(dragRef.current.startWidth + direction * (event.clientX - dragRef.current.startX))
    }
  }
  const handlePointerUp = () => {
    dragRef.current = null
    document.body.style.cursor = ''
  }
  const handleDoubleClick = (event: MouseEvent) => {
    event.stopPropagation()
    if (!narrowed) {
      onResize(defaultWidth)
    }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!narrowed && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault()
      event.stopPropagation()
      onResize(width + direction * (event.key === 'ArrowRight' ? KEYBOARD_STEP : -KEYBOARD_STEP))
    }
  }

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={GIT_COLUMN_MIN}
      aria-valuemax={GIT_COLUMN_MAX}
      aria-valuenow={width}
      aria-disabled={narrowed}
      tabIndex={narrowed ? UNTABBABLE : TABBABLE}
      data-tip={narrowed ? NARROWED_TIP : label}
      className={`group/resizer absolute inset-y-0 z-10 flex w-[7px] justify-center focus-visible:outline-none ${narrowed ? 'cursor-default' : 'cursor-ew-resize'} ${side === ResizerSide.Right ? '-right-[4px]' : '-left-[4px]'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={stopClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="h-full w-px bg-tily-line group-hover/resizer:w-0.5 group-hover/resizer:bg-tily-green group-focus-visible/resizer:w-0.5 group-focus-visible/resizer:bg-tily-focus" />
    </span>
  )
}
