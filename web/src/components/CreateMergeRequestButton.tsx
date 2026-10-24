import type { MouseEvent } from 'react'
import { openMergeRequestForm } from '../forge/mergeRequestFormActions'
import { kindNoun } from '../forge/mergeRequestLabels'
import { branchKey, useForgeStore } from '../store/forgeStore'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface CreateMergeRequestButtonProps {
  path: string
  branch: string
  className?: string
}

export function CreateMergeRequestButton({ path, branch, className = '' }: CreateMergeRequestButtonProps) {
  const result = useForgeStore((store) => store.branches[branchKey(path, branch)])
  if (!result?.creatable) {
    return null
  }

  const noun = kindNoun(result.forge?.kind)
  const handleClick = (event: MouseEvent) => {
    event.stopPropagation()
    openMergeRequestForm(path, branch)
  }

  return (
    <button
      type="button"
      className={`flex shrink-0 cursor-pointer items-center gap-[3px] rounded font-mono text-tily-muted hover:text-tily-ink hover:underline ${className}`}
      data-tip={`Créer une ${noun} depuis « ${branch} »`}
      aria-label={`Créer une ${noun} depuis ${branch}`}
      onClick={handleClick}
    >
      <Icon name={IconName.Plus} size={9} className="shrink-0" />
      <span>{noun}</span>
    </button>
  )
}
