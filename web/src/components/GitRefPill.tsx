import { useMemo, type MouseEvent, type PointerEvent } from 'react'
import { GitRefKind, type GitRefLabel } from '../bridge/gitMessages'
import { beginRefDrag, sameRef } from '../git/gitDrag'
import { focusGitGraph } from '../git/gitFocus'
import { refLabelTip } from '../git/gitLabels'
import { useGitStore } from '../store/gitStore'
import { laneHoverTint, laneTint } from './gitGraphStyles'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { Spinner } from './Spinner'

interface GitRefPillProps {
  label: GitRefLabel
  text: string
  color: number
  onMenu: (label: GitRefLabel, x: number, y: number) => void
  onActivate: (label: GitRefLabel) => void
}

const KIND_ICONS: Record<GitRefKind, IconName | null> = {
  [GitRefKind.Head]: null,
  [GitRefKind.Branch]: IconName.Local,
  [GitRefKind.Remote]: IconName.Remote,
  [GitRefKind.Tag]: IconName.Tag,
}

const restoreGraphFocus = (): void => {
  focusGitGraph()
}

export function GitRefPill({ label, text, color, onMenu, onActivate }: GitRefPillProps) {
  const movable = label.kind === GitRefKind.Branch || label.kind === GitRefKind.Remote
  const handle = useMemo(() => ({ kind: label.kind, name: label.name }), [label.kind, label.name])
  const dropTarget = useGitStore((store) => movable && sameRef(store.drag?.target, handle))
  const dragged = useGitStore((store) => sameRef(store.drag?.source, handle))
  const pending = useGitStore((store) => store.busy !== null && store.busyRefs.some((ref) => ref === label.name || label.remotes.includes(ref)))
  const icon = KIND_ICONS[label.kind]
  const interactive = label.kind !== GitRefKind.Head
  const hoverClass = interactive ? `cursor-pointer hover:text-tily-ink ${laneHoverTint(color, label.current)}` : ''

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (movable) {
      beginRefDrag(event, handle, restoreGraphFocus)
    }
  }
  const handleContextMenu = (event: MouseEvent) => {
    if (label.kind !== GitRefKind.Head) {
      event.preventDefault()
      event.stopPropagation()
      onMenu(label, event.clientX, event.clientY)
    }
  }
  const handleDoubleClick = (event: MouseEvent) => {
    event.stopPropagation()
    onActivate(label)
  }

  return (
    <span
      data-git-drop-kind={movable ? label.kind : undefined}
      data-git-drop-name={movable ? label.name : undefined}
      data-tip={refLabelTip(label)}
      className={`flex h-[20px] min-w-0 shrink items-center gap-[4px] rounded px-[5px] text-[11px] ${laneTint(color, label.current)} ${label.current ? 'font-semibold text-tily-ink' : 'text-tily-ink-soft'} ${dropTarget ? 'outline-2 outline-tily-focus' : ''} ${dragged || pending ? 'opacity-50' : ''} ${hoverClass}`}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      {pending && <Spinner size={10} />}
      {label.current && <Icon name={IconName.Check} size={11} className="shrink-0 translate-y-px" />}
      <span className="min-w-0 truncate">{text}</span>
      {icon && <Icon name={icon} size={11} className="shrink-0 translate-y-px opacity-80" />}
      {label.remotes.length > 0 && <Icon name={IconName.Remote} size={11} className="shrink-0 translate-y-px opacity-80" />}
    </span>
  )
}
