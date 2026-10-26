import { useShallow } from 'zustand/react/shallow'
import type { GitState } from '../bridge/gitMessages'
import { OPERATION_LABELS, plural } from '../git/gitLabels'
import { abortOperation, continueOperation, forcePush, pullBranch } from '../git/gitRequests'
import { useGitStore } from '../store/gitStore'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { GIT_DANGER, GIT_PRIMARY, GIT_SECONDARY, ROW_ACTION } from './rightPanelStyles'

interface GitBannersProps {
  state: GitState
  busy: string | null
}

const BANNER = 'mx-[8px] mb-[6px] flex flex-col gap-[6px] rounded border bg-tily-panel px-[10px] py-[8px] text-[12px]'

const handleDismissFailure = () => useGitStore.getState().setFailure(null)
const handleDismissRejection = () => useGitStore.getState().setRejection(null)

export function GitBanners({ state, busy }: GitBannersProps) {
  const { failure, rejection } = useGitStore(useShallow((store) => ({ failure: store.failure, rejection: store.rejection })))
  const conflicts = state.conflicts.length
  const operation = state.operation

  const handleContinue = () => {
    if (conflicts === 0 && !busy) {
      continueOperation()
    }
  }

  return (
    <>
      {operation && (
        <div role="status" className={`${BANNER} border-tily-warning/50`}>
          <span className="text-tily-warning">{`${OPERATION_LABELS[operation]} en cours · ${conflicts > 0 ? plural(conflicts, 'fichier en conflit', 'fichiers en conflit') : 'conflits résolus'}`}</span>
          <div className="flex flex-wrap gap-[6px]">
            <button type="button" className={GIT_PRIMARY} aria-disabled={conflicts > 0 || busy !== null} data-tip={conflicts > 0 ? 'Marquez d’abord tous les fichiers résolus' : 'Terminer l’opération'} onClick={handleContinue}>
              Terminer
            </button>
            <button type="button" className={GIT_SECONDARY} data-tip="Abandonner l’opération" onClick={abortOperation}>
              Abandonner
            </button>
          </div>
        </div>
      )}
      {rejection && state.forcePushAllowed && (
        <div role="alert" className={`${BANNER} border-tily-warning/50`}>
          <div className="flex items-start gap-[6px]">
            <span className="min-w-0 flex-1 text-tily-warning">{rejection.message}</span>
            <button type="button" className={ROW_ACTION} aria-label="Masquer" data-tip="Masquer" onClick={handleDismissRejection}>
              <Icon name={IconName.Close} size={10} />
            </button>
          </div>
          <div className="flex flex-wrap gap-[6px]">
            <button type="button" className={GIT_SECONDARY} onClick={pullBranch}>
              Pull
            </button>
            <button type="button" className={GIT_DANGER} data-tip="Push --force-with-lease" onClick={forcePush}>
              Forcer le push…
            </button>
          </div>
        </div>
      )}
      {failure && (
        <div role={failure.warning ? 'status' : 'alert'} className={`${BANNER} ${failure.warning ? 'border-tily-warning/50' : 'border-tily-error/50'}`}>
          <div className="flex items-start gap-[6px]">
            <span className={`min-w-0 flex-1 ${failure.warning ? 'text-tily-warning' : 'text-tily-error'}`}>{failure.message}</span>
            <button type="button" className={ROW_ACTION} aria-label="Masquer" data-tip="Masquer" onClick={handleDismissFailure}>
              <Icon name={IconName.Close} size={10} />
            </button>
          </div>
          {failure.output && <pre className="max-h-[160px] overflow-auto rounded bg-tily-terminal px-[8px] py-[6px] font-mono text-[11px] whitespace-pre-wrap text-tily-ink-soft">{failure.output}</pre>}
        </div>
      )}
    </>
  )
}
