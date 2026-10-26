import type { MouseEvent } from 'react'
import { GitDiffSource } from '../bridge/gitMessages'
import { applyDiffSelection, clearDiffSelection, DiffLineAction } from '../git/gitDiffActions'
import { plural } from '../git/gitLabels'
import { GitToolButton } from './GitToolButton'
import { IconName } from './iconName'

interface GitDiffSelectionBarProps {
  count: number
  source: GitDiffSource
}

const handleStage = () => applyDiffSelection(DiffLineAction.Stage)
const handleUnstage = () => applyDiffSelection(DiffLineAction.Unstage)
const handleDiscard = () => applyDiffSelection(DiffLineAction.Discard)

const keepDiffFocus = (event: MouseEvent<HTMLDivElement>) => event.preventDefault()

export function GitDiffSelectionBar({ count, source }: GitDiffSelectionBarProps) {
  return (
    <div role="toolbar" aria-label="Lignes choisies" className="absolute right-[16px] bottom-[12px] z-10 flex items-center gap-[2px] rounded-lg border border-tily-line bg-tily-panel py-[3px] pr-[3px] pl-[10px] shadow-lg" onMouseDown={keepDiffFocus}>
      <span className="mr-[6px] text-[12px] whitespace-nowrap text-tily-ink-soft">{plural(count, 'ligne choisie', 'lignes choisies')}</span>
      {source === GitDiffSource.Staged ? (
        <GitToolButton icon={IconName.Minus} label="Unstage" tip="Unstage des lignes choisies (Espace)" onClick={handleUnstage} />
      ) : (
        <>
          <GitToolButton icon={IconName.Discard} tip="Abandonner les lignes choisies (Suppr)" onClick={handleDiscard} />
          <GitToolButton icon={IconName.Plus} label="Stage" tip="Stage des lignes choisies (Espace)" onClick={handleStage} />
        </>
      )}
      <GitToolButton icon={IconName.Close} tip="Effacer la sélection (Échap)" onClick={clearDiffSelection} />
    </div>
  )
}
