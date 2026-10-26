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
import { PANEL_HEADER_BUTTON, SECTION_TITLE } from './rightPanelStyles'

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
      <div className="flex h-[30px] shrink-0 items-center gap-[8px] border-y border-tily-line pr-[6px] pl-[12px]">
        <span className="flex min-w-0 items-baseline gap-[8px]">
          <span className={SECTION_TITLE}>{stash ? 'Stash' : 'Commit'}</span>
          <span className="min-w-0 truncate font-mono text-[11px] text-tily-green-deep">{stash ? `stash@{${stash.index}}` : shortSha(commit)}</span>
        </span>
        <span className="flex-1" />
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Revenir aux modifications" data-tip="Revenir aux modifications (ligne WIP du graphe)" onClick={selectWorkingTree}>
          <Icon name={IconName.Close} />
        </button>
      </div>
      {stash && (
        <div className="flex shrink-0 items-center gap-[2px] border-b border-tily-line px-[8px] py-[3px]">
          <GitToolButton icon={IconName.Stash} label="Appliquer" tip="Appliquer ce stash en le gardant" disabled={blocked} onClick={handleApply} />
          <GitToolButton icon={IconName.Check} label="Appliquer et supprimer" tip="Appliquer ce stash puis le supprimer" disabled={blocked} onClick={handlePop} />
          <span className="flex-1" />
          <GitToolButton icon={IconName.Discard} label="Supprimer" tip="Supprimer ce stash" disabled={busy !== null} onClick={handleDrop} />
        </div>
      )}
      <GitCommitSummary details={details?.sha === commit ? details : null} error={detailsError} selected={file} stash={Boolean(stash)} />
    </div>
  )
}
