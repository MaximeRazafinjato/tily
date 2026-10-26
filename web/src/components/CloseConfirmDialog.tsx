import { useEffect, useRef, type PointerEvent } from 'react'
import type { CloseConfirmation } from '../store/uiStore'
import { keepTabInside } from './focusTrap'
import { InfoTip } from './InfoTip'

interface CloseConfirmDialogProps {
  confirmation: CloseConfirmation
  onConfirm: () => void
  onCancel: () => void
}

const BUTTON = 'cursor-pointer rounded border px-3 py-1.5 text-[12px]'
const DANGER = `${BUTTON} border-tily-error text-tily-error hover:bg-tily-green-hover`
const SECONDARY = `${BUTTON} border-tily-line text-tily-ink hover:bg-tily-green-hover`

export function CloseConfirmDialog({ confirmation, onConfirm, onCancel }: CloseConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [onCancel])

  const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onCancel()
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-tily-paper/60 pt-[12vh]" onPointerDown={handleBackdropPointerDown}>
      <div role="alertdialog" aria-label={confirmation.title} className="flex max-h-[76vh] w-[520px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={keepTabInside}>
        <div className="flex items-baseline justify-between border-b border-tily-line px-4 py-3">
          <h2 className="truncate text-[15px] font-semibold text-tily-ink">{confirmation.title}</h2>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          <span className="flex items-center gap-1.5">
            <p className="text-[12px] text-tily-warning">Ces programmes seront arrêtés de force.</p>
            <InfoTip text="Avec tout leur arbre de processus." />
          </span>
          <ul className="flex flex-col divide-y divide-tily-line rounded border border-tily-line bg-tily-paper">
            {confirmation.panes.map((pane) => (
              <li key={pane.paneId} className="flex items-baseline gap-3 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[12px] text-tily-ink">{pane.label}</span>
                <span className="max-w-[50%] shrink-0 truncate text-[11px] text-tily-muted">{pane.processes.join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-tily-line px-4 py-3">
          <button type="button" className={SECONDARY} data-tip="Échap" onClick={onCancel}>
            Annuler
          </button>
          <button ref={confirmRef} type="button" className={DANGER} data-tip="Entrée" onClick={onConfirm}>
            {confirmation.confirmLabel ?? 'Arrêter et fermer'}
          </button>
        </div>
      </div>
    </div>
  )
}
