import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import type { WorktreeRemoval } from '../store/worktreeStore'
import { cancelWorktreeRemoval, changeWorktreeRemoval, confirmWorktreeRemoval } from '../worktree/worktreeActions'
import { keepTabInside } from './focusTrap'
import { InfoTip } from './InfoTip'
import { SETTINGS_BUTTON, SETTINGS_SECONDARY } from './settingsStyles'
import { WorktreeFailureDetails } from './WorktreeFailureDetails'
import { WorktreePathLabel } from './WorktreePathLabel'

interface WorktreeRemoveDialogProps {
  removal: WorktreeRemoval
}

const DANGER = `${SETTINGS_BUTTON} border-tily-error text-tily-error hover:bg-tily-green-hover aria-disabled:cursor-default aria-disabled:opacity-50`
const ARM_DELAY_MS = 600
const CHECK_LABEL = 'flex items-center gap-2 text-[12px] text-tily-ink'
const ROW_LABEL = 'flex min-h-[28px] items-center text-[12px] text-tily-muted'
const ROW_VALUE = 'flex min-h-[28px] min-w-0 items-center'

const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
  if (event.target === event.currentTarget) {
    cancelWorktreeRemoval()
  }
}

const handleClosePanesChange = (event: ChangeEvent<HTMLInputElement>) => changeWorktreeRemoval({ closePanes: event.target.checked })
const handleKeepBranchChange = (event: ChangeEvent<HTMLInputElement>) => changeWorktreeRemoval({ keepBranch: event.target.checked })
const handleDropDatabaseChange = (event: ChangeEvent<HTMLInputElement>) => changeWorktreeRemoval({ dropDatabase: event.target.checked })

export function WorktreeRemoveDialog({ removal }: WorktreeRemoveDialogProps) {
  const { name, path, branch, panes, closePanes, keepBranch, dropDatabase, failure, requestedBy } = removal
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [armed, setArmed] = useState(!requestedBy)
  const title = `Supprimer le worktree « ${name} » ?`

  useEffect(() => {
    const initialButton = requestedBy ? cancelRef.current : confirmRef.current
    initialButton?.focus()
    const timer = requestedBy ? setTimeout(() => setArmed(true), ARM_DELAY_MS) : undefined
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelWorktreeRemoval()
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [requestedBy])

  const handleConfirm = () => {
    if (armed) {
      confirmWorktreeRemoval()
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-tily-paper/60 pt-[12vh]" onPointerDown={handleBackdropPointerDown}>
      <div role="alertdialog" aria-label={title} className="flex max-h-[76vh] w-[540px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={keepTabInside}>
        <div className="flex items-baseline justify-between border-b border-tily-line px-4 py-3">
          <h2 className="truncate text-[15px] font-semibold text-tily-ink">{title}</h2>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-4 overflow-y-auto px-4 py-4">
          {requestedBy && (
            <>
              <span className={ROW_LABEL}>Demandé par</span>
              <span className={`${ROW_VALUE} gap-1.5 text-[12px] text-tily-ink`}>
                {requestedBy}
                <InfoTip text="Sans réponse dans les 2 minutes, la demande est refusée." />
              </span>
            </>
          )}
          <span className={ROW_LABEL}>Dossier</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className={ROW_VALUE}>
              <WorktreePathLabel path={path} />
            </span>
            <span className="text-[11px] text-tily-warning">Supprimé avec ses modifications non commitées.</span>
          </div>
          {branch && (
            <>
              <span className={ROW_LABEL}>Branche</span>
              <span className={`${ROW_VALUE} gap-4`}>
                <span className="min-w-0 truncate text-[12px] text-tily-ink">{branch}</span>
                <label className={`${CHECK_LABEL} shrink-0`}>
                  <input type="checkbox" checked={keepBranch} onChange={handleKeepBranchChange} />
                  Garder
                </label>
              </span>
            </>
          )}
          {panes.length > 0 && (
            <>
              <span className={ROW_LABEL}>Panes</span>
              <div className="flex min-w-0 flex-col gap-2">
                <ul className="flex flex-col divide-y divide-tily-line rounded border border-tily-line bg-tily-paper">
                  {panes.map((pane) => (
                    <li key={pane.paneId} className="flex min-h-[28px] items-center gap-2 px-3 py-1 text-[12px] text-tily-ink">
                      <span className="min-w-0 flex-1 truncate">{pane.label}</span>
                      {pane.agent && <span className="shrink-0 text-[11px] text-tily-warning">agent actif</span>}
                    </li>
                  ))}
                </ul>
                <span className="flex items-center gap-1.5">
                  <label className={CHECK_LABEL}>
                    <input type="checkbox" checked={closePanes} onChange={handleClosePanesChange} />
                    Fermer ces onglets et panes
                  </label>
                  <InfoTip text="Leurs programmes sont arrêtés." />
                </span>
                {!closePanes && <p className="text-[11px] text-tily-warning">Un shell ouvert verrouille le dossier : la suppression échouera sans doute.</p>}
              </div>
            </>
          )}
          <span className={ROW_LABEL}>Base</span>
          <span className={`${ROW_VALUE} gap-1.5`}>
            <label className={CHECK_LABEL}>
              <input type="checkbox" checked={dropDatabase} onChange={handleDropDatabaseChange} />
              Supprimer la réplique
            </label>
            <InfoTip text="Base répliquée pour ce worktree, jamais celle du dépôt principal." />
          </span>
          {failure && (
            <div className="col-span-2">
              <WorktreeFailureDetails failure={failure} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-tily-line px-4 py-3">
          <button ref={cancelRef} type="button" className={SETTINGS_SECONDARY} data-tip={requestedBy ? 'Entrée ou Échap' : 'Échap'} onClick={cancelWorktreeRemoval}>
            Annuler
          </button>
          <button ref={confirmRef} type="button" className={DANGER} aria-disabled={!armed} data-tip={requestedBy ? undefined : 'Entrée'} onClick={handleConfirm}>
            {failure ? 'Réessayer' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
