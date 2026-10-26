import { useShallow } from 'zustand/react/shallow'
import type { GitState } from '../bridge/gitMessages'
import { shortSha } from '../git/gitLabels'
import { applyStash, dropStash } from '../git/gitRefActions'
import { selectWorkingTree } from '../git/gitRequests'
import { useGitStore } from '../store/gitStore'
import { GitCommitSummary } from './GitCommitSummary'
import { GitToolButton } from './GitToolButton'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SECTION_HEADING } from './rightPanelStyles'

interface GitCommitDetailProps {
  state: GitState
  busy: string | null
}

export function GitCommitDetail({ state, busy }: GitCommitDetailProps) {
  const { commit, details, detailsError, file } = useGitStore(useShallow((store) => ({ commit: store.commit, details: store.details, detailsError: store.detailsError, file: store.file })))
  if (!commit) {
    return null
  }
  const stash = state.stashes.find((candidate) => candidate.sha === commit)
  const blocked = busy !== null || Boolean(state.operation)
  const handleApply = () => stash && applyStash(stash, false)
  const handlePop = () => stash && applyStash(stash, true)
  const handleDrop = () => stash && dropStash(stash)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button type="button" className="mt-[4px] flex h-[28px] shrink-0 cursor-pointer items-center gap-[4px] self-start rounded px-[10px] text-[12px] text-tily-muted hover:text-tily-ink" data-tip="Revenir aux modifications (Échap)" onClick={selectWorkingTree}>
        <Icon name={IconName.Chevron} size={10} className="rotate-180" />
        Modifications
      </button>
      <GitCommitSummary
        details={details?.sha === commit ? details : null}
        error={detailsError}
        selected={file}
        stash={Boolean(stash)}
        heading={
          <span className="flex min-w-0 items-baseline gap-[8px]">
            <span className={SECTION_HEADING}>{stash ? 'Stash' : 'Commit'}</span>
            <span className="min-w-0 truncate text-[11px] text-tily-green-deep">{stash ? `stash@{${stash.index}}` : shortSha(commit)}</span>
          </span>
        }
        actions={
          stash && (
            <div className="-mx-[6px] flex items-center gap-[2px]">
              <GitToolButton icon={IconName.Stash} label="Appliquer" tip="Appliquer ce stash en le gardant" disabled={blocked} onClick={handleApply} />
              <GitToolButton icon={IconName.Check} tip="Appliquer ce stash puis le supprimer" disabled={blocked} onClick={handlePop} />
              <span className="flex-1" />
              <GitToolButton icon={IconName.Discard} tip="Supprimer ce stash" disabled={busy !== null} onClick={handleDrop} />
            </div>
          )
        }
      />
    </div>
  )
}
