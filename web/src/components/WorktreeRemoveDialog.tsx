import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import type { WorktreeRemoval } from '../store/worktreeStore'
import { cancelWorktreeRemoval, changeWorktreeRemoval, confirmWorktreeRemoval } from '../worktree/worktreeActions'
import { keepTabInside } from './focusTrap'
import { SETTINGS_BUTTON, SETTINGS_HINT, SETTINGS_SECONDARY } from './settingsStyles'
import { WorktreeFailureDetails } from './WorktreeFailureDetails'

interface WorktreeRemoveDialogProps {
  removal: WorktreeRemoval
}

const DANGER = `${SETTINGS_BUTTON} border-tily-error text-tily-error hover:bg-tily-green-hover aria-disabled:cursor-default aria-disabled:opacity-50`
const ARM_DELAY_MS = 600
const CHECK_LABEL = 'flex items-center gap-2 text-[12px] text-tily-ink'

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
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {requestedBy && <p className="text-[12px] text-tily-ink">{`Demandé par ${requestedBy}. Sans réponse dans les 2 minutes, la demande est refusée.`}</p>}
          <p className={`${SETTINGS_HINT}`}>{path}</p>
          <p className="text-[12px] text-tily-warning">Le dossier est supprimé avec ses modifications non commitées.</p>
          {panes.length > 0 && (
            <>
              <ul className="flex flex-col gap-1">
                {panes.map((pane) => (
                  <li key={pane.paneId} className="flex items-center gap-2 rounded border border-tily-line bg-tily-paper px-3 py-1.5 text-[12px] text-tily-ink">
                    <span className="min-w-0 flex-1 truncate">{pane.label}</span>
                    {pane.agent && <span className="shrink-0 text-[11px] text-tily-warning">agent actif</span>}
                  </li>
                ))}
              </ul>
              <label className={CHECK_LABEL}>
                <input type="checkbox" checked={closePanes} onChange={handleClosePanesChange} />
                Fermer ces onglets et panes (leurs programmes sont arrêtés)
              </label>
              {!closePanes && <p className="text-[11px] text-tily-warning">Un shell ouvert dans le dossier le verrouille : la suppression échouera probablement.</p>}
            </>
          )}
          {branch && (
            <label className={CHECK_LABEL}>
              <input type="checkbox" checked={keepBranch} onChange={handleKeepBranchChange} />
              {`Garder la branche « ${branch} »`}
            </label>
          )}
          <label className={CHECK_LABEL}>
            <input type="checkbox" checked={dropDatabase} onChange={handleDropDatabaseChange} />
            Supprimer la base répliquée (jamais celle du dépôt principal)
          </label>
          {failure && <WorktreeFailureDetails failure={failure} />}
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
