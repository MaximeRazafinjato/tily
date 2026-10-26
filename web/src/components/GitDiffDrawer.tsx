import type { KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GitChangeKind, GitDiffSource, type GitFileChange } from '../bridge/gitMessages'
import { isDiffSelectable } from '../git/gitDiffActions'
import { canCopyDiff, copyDiff, copyDiffTip } from '../git/gitDiffText'
import { focusGitPanel } from '../git/gitFocus'
import { shortSha } from '../git/gitLabels'
import { closeDrawer, discardChanges, openInEditor, stageChanges, unstageChanges } from '../git/gitRequests'
import { useGitStore, type GitFileTarget } from '../store/gitStore'
import { GitDiffView } from './GitDiffView'
import { GitToolButton } from './GitToolButton'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { PANEL_HEADER_BUTTON } from './rightPanelStyles'

const SOURCE_LABELS: Record<GitDiffSource, string> = {
  [GitDiffSource.Unstaged]: 'Unstaged',
  [GitDiffSource.Staged]: 'Staged',
  [GitDiffSource.Commit]: 'Commit',
}

const asChange = (file: GitFileTarget): GitFileChange => ({ path: file.path, oldPath: file.oldPath, kind: file.untracked ? GitChangeKind.Untracked : GitChangeKind.Modified })

const handleClose = () => {
  closeDrawer()
  focusGitPanel()
}

const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    handleClose()
  }
}

export function GitDiffDrawer() {
  const { file, diff, diffError, stashes } = useGitStore(useShallow((store) => ({ file: store.file, diff: store.diff, diffError: store.diffError, stashes: store.state?.stashes })))
  if (!file) {
    return null
  }
  const working = file.commit ? null : file
  const stash = file.commit ? stashes?.find((candidate) => candidate.sha === file.commit) : undefined
  const context = file.commit ? (stash ? `stash@{${stash.index}}` : `Commit ${shortSha(file.commit)}`) : file.untracked ? 'Non suivi' : SOURCE_LABELS[file.source]
  const handleEdit = () => working && openInEditor(working.path)
  const handleStage = () => working && stageChanges([asChange(working)])
  const handleUnstage = () => working && unstageChanges([asChange(working)])
  const handleDiscard = () => working && discardChanges([asChange(working)], 1)
  const handleCopyDiff = () => copyDiff(diff)

  return (
    <aside aria-label="Diff du fichier" data-git-drawer="" className="absolute inset-y-0 right-0 z-20 flex w-[min(920px,100%)] flex-col border-l border-tily-line bg-tily-panel shadow-2xl" onKeyDown={handleKeyDown}>
      <header className="flex h-[36px] shrink-0 items-center gap-[8px] border-b border-tily-line pr-[6px] pl-[12px]">
        <span className="shrink-0 rounded bg-tily-paper px-[6px] py-[1px] text-[11px] text-tily-muted">{context}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-tily-ink" data-tip={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>
          {file.path}
        </span>
        <GitToolButton icon={IconName.Copy} tip={copyDiffTip(diff)} disabled={!canCopyDiff(diff)} onClick={handleCopyDiff} />
        {working && (
          <span className="flex shrink-0 items-center gap-[2px]">
            <GitToolButton icon={IconName.Editor} tip="Ouvrir dans l’éditeur" onClick={handleEdit} />
            {working.source === GitDiffSource.Staged ? (
              <GitToolButton icon={IconName.Minus} tip="Unstage" onClick={handleUnstage} />
            ) : (
              <>
                <GitToolButton icon={IconName.Discard} tip="Abandonner les modifications" onClick={handleDiscard} />
                <GitToolButton icon={IconName.Plus} tip="Stage" onClick={handleStage} />
              </>
            )}
          </span>
        )}
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Fermer" data-tip="Fermer (Échap)" onClick={handleClose}>
          <Icon name={IconName.Close} />
        </button>
      </header>
      <GitDiffView key={`${file.source}\n${file.path}\n${file.commit ?? ''}`} diff={diff} error={diffError} placeholder="Chargement du diff…" selectable={isDiffSelectable(diff, file) ? file.source : null} />
    </aside>
  )
}
