import type { GitState } from '../bridge/gitMessages'
import { headSummary, plural } from '../git/gitLabels'
import { copyToClipboard, fetchRemote, pullBranch, pushBranch, refreshRepository, undoLastOperation } from '../git/gitRequests'
import { toggleGitGraph } from '../panel/rightPanel'
import { useGitStore } from '../store/gitStore'
import { GitAheadBehind } from './GitAheadBehind'
import { GitToolButton } from './GitToolButton'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface GitHeaderProps {
  state: GitState
  busy: string | null
}

const HEAD_LABEL = 'flex max-w-max min-w-0 flex-1 items-baseline gap-[4px] text-tily-green-deep'

const undoTip = ({ undo }: GitState): string => {
  if (!undo) {
    return 'Aucune opération faite depuis Tily à annuler'
  }
  return undo.available ? `Annuler : ${undo.label}` : `Annulation impossible (${undo.reason ?? 'état inconnu'}) : ${undo.label}`
}

export function GitHeader({ state, busy }: GitHeaderProps) {
  const { head, remotes } = state
  const graphOpen = useGitStore((store) => store.graphOpen)
  const working = busy !== null
  const noRemote = remotes.length === 0
  const copiedBranch = head.detached ? null : head.branch
  const handleCopyBranch = () => {
    if (copiedBranch) {
      copyToClipboard(copiedBranch, `Branche « ${copiedBranch} » copiée.`)
    }
  }
  const headLabel = (
    <>
      <Icon name={IconName.Branch} className="shrink-0 -translate-y-[0.5px] self-center" />
      <span className="truncate">{headSummary(head)}</span>
    </>
  )
  const trackingTip = head.upstream ? `${plural(head.ahead, 'commit', 'commits')} à push, ${plural(head.behind, 'commit', 'commits')} à pull depuis ${head.upstream}` : ''
  const pushTip = head.detached
    ? 'HEAD détachée : faites le checkout d’une branche avant le push'
    : head.upstream
      ? `Push vers ${head.upstream}`
      : noRemote
        ? 'Aucun dépôt distant configuré'
        : `Push de « ${head.branch ?? ''} »`

  return (
    <div className="flex shrink-0 flex-col gap-[4px] border-y border-tily-line bg-tily-panel px-[10px] pt-[8px] pb-[6px]">
      <div className="flex min-w-0 items-center gap-[8px] pl-[2px] text-[12px]">
        <span className="flex min-w-0 items-baseline gap-[8px]">
          {copiedBranch ? (
            <button type="button" className={`${HEAD_LABEL} cursor-pointer hover:underline`} data-tip={`Copier la branche « ${copiedBranch} »`} aria-label="Copier la branche Git" onClick={handleCopyBranch}>
              {headLabel}
            </button>
          ) : (
            <span className={HEAD_LABEL} data-tip={headSummary(head)}>
              {headLabel}
            </span>
          )}
          {head.upstream && (head.ahead > 0 || head.behind > 0) && (
            <GitAheadBehind ahead={head.ahead} behind={head.behind} tip={trackingTip} />
          )}
          {!head.upstream && head.branch && !head.unborn && (
            <span role="img" className="flex shrink-0 self-center text-tily-muted" aria-label="Branche non publiée" data-tip="Branche non publiée">
              <Icon name={IconName.RemoteOff} />
            </span>
          )}
        </span>
        <span className="ml-auto" />
        <GitToolButton icon={IconName.Graph} label="Graphe" tip={graphOpen ? 'Masquer le graphe' : 'Afficher le graphe'} pressed={graphOpen} onClick={toggleGitGraph} />
      </div>
      <div className="@container -mx-[4px] flex flex-wrap items-center gap-[2px]">
        <GitToolButton icon={IconName.Fetch} label="Fetch" tip={noRemote ? 'Aucun dépôt distant configuré' : 'Fetch de toutes les branches distantes'} disabled={working || noRemote} onClick={fetchRemote} />
        <GitToolButton icon={IconName.Pull} label={head.behind > 0 ? `Pull ${head.behind}` : 'Pull'} tip={head.upstream ? `Pull depuis ${head.upstream}` : 'Aucune branche distante suivie'} disabled={working || !head.upstream} onClick={pullBranch} />
        <GitToolButton icon={IconName.Push} label={head.ahead > 0 ? `Push ${head.ahead}` : 'Push'} tip={pushTip} disabled={working || head.detached || head.unborn || noRemote} onClick={pushBranch} />
        <span className="flex-1" />
        <GitToolButton icon={IconName.Undo} label="Annuler" labelClassName="@max-[300px]:hidden" tip={undoTip(state)} disabled={working || !state.undo?.available} onClick={undoLastOperation} />
        <GitToolButton icon={IconName.Refresh} tip="Actualiser (F5)" onClick={refreshRepository} />
      </div>
    </div>
  )
}
