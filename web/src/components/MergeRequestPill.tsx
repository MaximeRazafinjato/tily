import type { MouseEvent } from 'react'
import { openMergeRequest } from '../forge/mergeRequestActions'
import { openMergeRequestMenu } from '../forge/mergeRequestMenu'
import { kindNoun, mergeRequestTip, statusTone } from '../forge/mergeRequestLabels'
import { branchKey, useForgeStore } from '../store/forgeStore'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface MergeRequestPillProps {
  path: string
  branch: string
  className?: string
}

export function MergeRequestPill({ path, branch, className = '' }: MergeRequestPillProps) {
  const result = useForgeStore((store) => store.branches[branchKey(path, branch)])
  const first = result?.items[0]
  if (!first) {
    return null
  }

  const others = result.items.length - 1
  const noun = kindNoun(result.forge?.kind)
  const tip = others > 0 ? `${mergeRequestTip(first)} · ${others} autre${others > 1 ? 's' : ''} ${noun} sur cette branche` : mergeRequestTip(first)
  const handleClick = (event: MouseEvent) => {
    event.stopPropagation()
    openMergeRequest(first.url, event.shiftKey)
  }
  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => openMergeRequestMenu(event, path, result.forge?.kind, result.items)

  return (
    <button
      type="button"
      className={`flex shrink-0 cursor-pointer items-center gap-[3px] rounded hover:underline ${statusTone(first)} ${className}`}
      data-tip={tip}
      aria-label={`${noun} ${first.reference} : ${first.title}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <Icon name={IconName.MergeRequest} size={11} className="shrink-0" />
      <span>{`${noun} ${first.reference}`}</span>
      {others > 0 && <span className="text-tily-muted">{`+${others}`}</span>}
    </button>
  )
}
