import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react'
import { refIndent } from '../git/gitBranchTree'
import { beginRefDrag, sameRef } from '../git/gitDrag'
import { selectModeOf, type GitSelectMode } from '../git/gitRows'
import { useGitStore, type GitRefHandle } from '../store/gitStore'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { ROW_ACTION } from './rightPanelStyles'
import { Spinner } from './Spinner'
import { isMenuKey } from './workspacePanel'

interface GitRefRowProps {
  rowKey: string
  name: string
  meta?: ReactNode
  metaIcon?: IconName
  metaTip?: string
  tip?: string
  current?: boolean
  selected: boolean
  depth?: number
  focusable: boolean
  handle?: GitRefHandle
  refName?: string
  onFocus: (key: string) => void
  onActivate: () => void
  onSelect: (mode: GitSelectMode) => void
  onMenu: (x: number, y: number) => void
}

export function GitRefRow({ rowKey, name, meta, metaIcon, metaTip, tip, current = false, selected, depth = 0, focusable, handle, refName, onFocus, onActivate, onSelect, onMenu }: GitRefRowProps) {
  const dropTarget = useGitStore((store) => handle !== undefined && sameRef(store.drag?.target, handle))
  const pending = useGitStore((store) => refName !== undefined && store.busy !== null && store.busyRefs.includes(refName))
  const handleClick = (event: MouseEvent) => {
    onFocus(rowKey)
    onSelect(selectModeOf(event))
  }
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    onFocus(rowKey)
    onMenu(event.clientX, event.clientY)
  }
  const handleMoreClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    onMenu(rect.left, rect.bottom)
  }
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (handle) {
      const row = event.currentTarget
      beginRefDrag(event, handle, () => row.focus())
    }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      onActivate()
    } else if (isMenuKey(event)) {
      event.preventDefault()
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      onMenu(rect.left + 24, rect.bottom)
    }
  }

  return (
    <div
      role="option"
      aria-selected={selected}
      data-git-row={rowKey}
      data-git-drop-kind={handle?.kind}
      data-git-drop-name={handle?.name}
      tabIndex={focusable ? 0 : -1}
      data-tip={tip}
      style={{ paddingLeft: refIndent(depth) }}
      className={`group flex h-[24px] cursor-pointer items-center gap-[6px] pr-[4px] text-[12px] select-none ${selected ? 'bg-tily-green-soft' : 'hover:bg-tily-green-hover'} ${current || selected ? 'text-tily-green-deep' : 'text-tily-ink-soft hover:text-tily-ink'} ${dropTarget ? 'outline-2 -outline-offset-2 outline-tily-focus' : ''} ${pending ? 'opacity-60' : ''}`}
      onClick={handleClick}
      onDoubleClick={onActivate}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      <span className="flex w-[12px] shrink-0 translate-y-px justify-center text-tily-green">
        {pending ? <Spinner /> : current && <Icon name={IconName.Check} />}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-[6px]">
        <span className={`min-w-0 flex-1 truncate ${current ? 'font-semibold' : ''}`}>{name}</span>
        {metaIcon && (
          <span className="flex shrink-0 translate-y-px self-center text-tily-muted" data-tip={metaTip}>
            <Icon name={metaIcon} />
          </span>
        )}
        {meta && (
          <span className="max-w-[45%] min-w-0 truncate text-[11px] text-tily-muted" data-tip={metaTip}>
            {meta}
          </span>
        )}
      </span>
      <button type="button" tabIndex={-1} className={`${ROW_ACTION} opacity-0 group-focus-within:opacity-100 group-hover:opacity-100`} aria-label={`Actions de ${name}`} data-tip="Actions (Maj+F10)" onClick={handleMoreClick}>
        <Icon name={IconName.More} />
      </button>
    </div>
  )
}
