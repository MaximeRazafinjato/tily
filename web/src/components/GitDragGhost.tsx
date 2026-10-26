import { useShallow } from 'zustand/react/shallow'
import { GitRefKind } from '../bridge/gitMessages'
import { useGitStore } from '../store/gitStore'
import { Icon } from './Icon'
import { IconName } from './iconName'

const POINTER_OFFSET_X = 14
const POINTER_OFFSET_Y = 10

export function GitDragGhost() {
  const { drag, currentBranch } = useGitStore(useShallow((store) => ({ drag: store.drag, currentBranch: store.state?.head.branch })))
  if (!drag) {
    return null
  }
  const draggingCurrent = drag.source.kind === GitRefKind.Branch && drag.source.name === currentBranch
  const hint = drag.target ? `→ ${drag.target.name}` : draggingCurrent ? 'Déposez sur une autre branche' : 'Déposez sur la branche courante'

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 flex max-w-[360px] items-center gap-[6px] rounded-md border border-tily-line bg-tily-paper px-[8px] py-[3px] text-[11px] text-tily-ink shadow-lg"
      style={{ left: drag.x + POINTER_OFFSET_X, top: drag.y + POINTER_OFFSET_Y }}
    >
      <Icon name={drag.source.kind === GitRefKind.Remote ? IconName.Remote : IconName.Local} className="shrink-0" />
      <span className="truncate font-semibold">{drag.source.name}</span>
      <span className={`shrink-0 ${drag.target ? 'text-tily-green-deep' : 'text-tily-muted'}`}>{hint}</span>
    </div>
  )
}
