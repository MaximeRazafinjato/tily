import { useEffect, useRef, type PointerEvent } from 'react'
import type { GitConfirmation } from '../store/gitStore'
import { keepTabInside } from './focusTrap'
import { GIT_DANGER, GIT_SECONDARY } from './rightPanelStyles'

interface GitConfirmDialogProps {
  confirmation: GitConfirmation
  onConfirm: () => void
  onCancel: () => void
}

export function GitConfirmDialog({ confirmation, onConfirm, onCancel }: GitConfirmDialogProps) {
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
      <div role="alertdialog" aria-label={confirmation.title} className="flex w-[500px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={keepTabInside}>
        <div className="flex items-center justify-between gap-3 border-b border-tily-line px-4 py-3">
          <h2 className="min-w-0 truncate text-[15px] font-semibold text-tily-ink" data-tip={confirmation.title}>
            {confirmation.title}
          </h2>
        </div>
        <div className="flex flex-col gap-2 px-4 py-4">
          <p className="text-[12px] text-tily-ink">{confirmation.body}</p>
          {confirmation.detail && <p className="max-h-[40vh] overflow-auto text-[11px] whitespace-pre-line text-tily-muted">{confirmation.detail}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-tily-line px-4 py-3">
          <button type="button" className={`${GIT_SECONDARY} py-1.5`} data-tip="Échap" onClick={onCancel}>
            Annuler
          </button>
          <button ref={confirmRef} type="button" className={`${GIT_DANGER} py-1.5`} data-tip="Entrée" onClick={onConfirm}>
            {confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
