import { memo, type MouseEvent } from 'react'
import { GitChangeKind } from '../bridge/gitMessages'
import { CHANGE_CLASSES, CHANGE_LABELS, CHANGE_LETTERS, CONFLICT_LABELS, fileFolder, fileName } from '../git/gitLabels'
import { GitRowGroup, selectModeOf, type GitChangeRow, type GitRowHandlers } from '../git/gitRows'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { ROW_ACTION, ROW_STAGE_BUTTON, ROW_UNSTAGE_BUTTON } from './rightPanelStyles'

interface GitFileRowProps {
  row: GitChangeRow
  selected: boolean
  focusable: boolean
  handlers: GitRowHandlers
}

const statusTip = ({ change, conflict }: GitChangeRow): string => {
  if (conflict) {
    return `En conflit : ${CONFLICT_LABELS[conflict.kind].toLowerCase()}`
  }
  return change?.oldPath ? `${CHANGE_LABELS[change.kind]} depuis ${change.oldPath}` : CHANGE_LABELS[change?.kind ?? GitChangeKind.Modified]
}

export const GitFileRow = memo(function GitFileRow({ row, selected, focusable, handlers }: GitFileRowProps) {
  const { change, conflict, group } = row
  const path = change?.path ?? conflict?.path ?? ''
  const letter = conflict ? '!' : CHANGE_LETTERS[change?.kind ?? GitChangeKind.Modified]
  const letterClass = conflict ? 'text-tily-error' : CHANGE_CLASSES[change?.kind ?? GitChangeKind.Modified]
  const canEdit = !change || change.kind !== GitChangeKind.Deleted

  const handleClick = (event: MouseEvent) => handlers.select(row, selectModeOf(event))
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    handlers.menu(row, event.clientX, event.clientY)
  }
  const handleDoubleClick = () => {
    if (conflict) {
      handlers.open(row)
    }
  }
  const stopping = (action: () => void) => (event: MouseEvent) => {
    event.stopPropagation()
    action()
  }
  const handleEdit = stopping(() => handlers.edit(path))
  const handleStage = stopping(() => change && handlers.stage(change))
  const handleUnstage = stopping(() => change && handlers.unstage(change))
  const handleDiscard = stopping(() => change && handlers.discard(change))
  const handleResolve = stopping(() => conflict && handlers.resolve(conflict))

  return (
    <div
      role="option"
      aria-selected={selected}
      data-git-row={row.key}
      tabIndex={focusable ? 0 : -1}
      className={`group flex h-[24px] cursor-pointer items-center gap-[6px] pr-[4px] pl-[12px] text-[12px] select-none ${selected ? 'bg-tily-green-soft text-tily-green-deep' : 'text-tily-ink-soft hover:bg-tily-green-hover hover:text-tily-ink'}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <span className="flex min-w-0 flex-1 items-baseline gap-[6px]">
        <span className={`w-[12px] shrink-0 text-center text-[11px] font-semibold ${letterClass}`} data-tip={statusTip(row)}>
          {letter}
        </span>
        <span className="min-w-0 shrink truncate">{fileName(path)}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-tily-muted" data-tip={path}>
          {fileFolder(path)}
        </span>
      </span>
      <span className="flex shrink-0 items-center opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
        {canEdit && (
          <button type="button" tabIndex={-1} className={ROW_ACTION} aria-label="Ouvrir dans l’éditeur" data-tip="Ouvrir dans l’éditeur" onClick={handleEdit}>
            <Icon name={IconName.Editor} />
          </button>
        )}
        {group === GitRowGroup.Conflict && (
          <button type="button" tabIndex={-1} className={ROW_ACTION} aria-label="Marquer résolu" data-tip="Marquer résolu (Espace)" onClick={handleResolve}>
            <Icon name={IconName.Check} />
          </button>
        )}
        {group === GitRowGroup.Staged && (
          <button type="button" tabIndex={-1} className={ROW_UNSTAGE_BUTTON} aria-label="Unstage" data-tip="Unstage (Espace)" onClick={handleUnstage}>
            <Icon name={IconName.Minus} />
          </button>
        )}
        {group === GitRowGroup.Unstaged && (
          <>
            <button type="button" tabIndex={-1} className={`${ROW_ACTION} hover:text-tily-error`} aria-label="Abandonner les modifications" data-tip="Abandonner les modifications (Suppr)" onClick={handleDiscard}>
              <Icon name={IconName.Discard} />
            </button>
            <button type="button" tabIndex={-1} className={ROW_STAGE_BUTTON} aria-label="Stage" data-tip="Stage (Espace)" onClick={handleStage}>
              <Icon name={IconName.Plus} />
            </button>
          </>
        )}
      </span>
    </div>
  )
})
