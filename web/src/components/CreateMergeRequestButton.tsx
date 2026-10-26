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
      className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink ${className}`}
      data-tip={`Créer une ${noun}`}
      aria-label={`Créer une ${noun} depuis ${branch}`}
      onClick={handleClick}
    >
      <Icon name={IconName.MergeRequest} />
    </button>
  )
}
