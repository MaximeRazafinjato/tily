import { memo, type MouseEvent } from 'react'
import type { ForgeKind, MergeRequest } from '../bridge/forgeMessages'
import { openMergeRequest } from '../forge/mergeRequestActions'
import { mergeRequestTip, reviewBadge, statusText, statusTone, updatedText } from '../forge/mergeRequestLabels'
import { openMergeRequestMenu } from '../forge/mergeRequestMenu'
import { EditMergeRequestButton } from './EditMergeRequestButton'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { MergeRequestAssignees } from './MergeRequestAssignees'

interface MergeRequestRowProps {
  path: string
  kind: ForgeKind | undefined
  item: MergeRequest
  current: boolean
}

const VISIBLE_LABELS = 3

export const MergeRequestRow = memo(function MergeRequestRow({ path, kind, item, current }: MergeRequestRowProps) {
  const handleClick = (event: MouseEvent) => openMergeRequest(item.url, event.shiftKey)
  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => openMergeRequestMenu(event, path, kind, [item])
  const hiddenLabels = item.labels.length - VISIBLE_LABELS
  const badge = reviewBadge(item)

  return (
    <div className="group relative">
      <button
        type="button"
        data-tip={mergeRequestTip(item)}
        aria-label={`${item.reference} ${item.title} : ${statusText(item)}`}
        className={`flex w-full cursor-pointer flex-col gap-[3px] rounded px-[8px] py-[5px] text-left hover:bg-tily-green-hover focus-visible:bg-tily-green-soft ${current ? 'bg-tily-green-soft' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="flex min-w-0 items-baseline gap-[6px] text-[12px]">
          <Icon name={IconName.MergeRequest} className={`shrink-0 self-center ${statusTone(item)}`} />
          <span className="min-w-0 truncate font-semibold text-tily-ink">{item.title}</span>
        </span>
        <span className="flex min-w-0 items-baseline gap-[6px] pl-[18px] text-[11px] text-tily-muted">
          <span className="shrink-0">{item.reference}</span>
          <span className="min-w-0 truncate">
            <span className="text-tily-ink-soft">{item.sourceBranch}</span>
            {` → ${item.targetBranch}`}
          </span>
          <span className="ml-auto shrink-0">{updatedText(item)}</span>
        </span>
        {(badge || item.labels.length > 0 || item.assignees.length > 0) && (
          <span className="flex min-w-0 flex-wrap items-center gap-[4px] pl-[18px] text-[11px]">
            {badge && <span className={`shrink-0 rounded-[3px] bg-current/15 px-[5px] ${statusTone(item)}`}>{badge}</span>}
            {item.labels.slice(0, VISIBLE_LABELS).map((label) => (
              <span key={label} className="max-w-[140px] truncate rounded-full border border-tily-line px-[6px] text-tily-ink-soft">
                {label}
              </span>
            ))}
            {hiddenLabels > 0 && <span className="shrink-0 text-tily-muted">{`+${hiddenLabels}`}</span>}
            {item.assignees.length > 0 && <MergeRequestAssignees users={item.assignees} />}
          </span>
        )}
      </button>
      <EditMergeRequestButton path={path} item={item} kind={kind} className="absolute top-[4px] right-[6px] bg-tily-panel opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100" />
    </div>
  )
})
