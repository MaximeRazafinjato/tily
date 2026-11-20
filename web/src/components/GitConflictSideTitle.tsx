import { useEffect, useRef } from 'react'
import type { ConflictSide } from '../git/conflictLayout'
import { PickCheck } from '../git/conflictPicks'

interface GitConflictSideTitleProps {
  side: ConflictSide
  title: string
  check: PickCheck
  disabled: boolean
  onToggle: (side: ConflictSide) => void
}

const TOGGLE_TIP = 'Prendre tous les conflits de cette version'

export function GitConflictSideTitle({ side, title, check, disabled, onToggle }: GitConflictSideTitleProps) {
  const boxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.indeterminate = check === PickCheck.Mixed
    }
  }, [check])

  const handleChange = () => onToggle(side)

  return (
    <div className="flex shrink-0 items-center gap-[8px] border-b border-tily-line bg-tily-paper px-[12px] py-[4px] text-[11px] font-semibold text-tily-muted">
      <input ref={boxRef} type="checkbox" checked={check === PickCheck.Checked} disabled={disabled} aria-label={TOGGLE_TIP} data-tip={TOGGLE_TIP} onChange={handleChange} />
      <span className="min-w-0 truncate" data-tip={title}>
        {title}
      </span>
    </div>
  )
}
