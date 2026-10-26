import { useEffect, useRef, type PointerEvent } from 'react'
import type { DeleteRequest } from '../store/explorerStore'
import { keepTabInside } from './focusTrap'

interface DeleteConfirmDialogProps {
  request: DeleteRequest
  onConfirm: (request: DeleteRequest) => void
  onCancel: () => void
}

const BUTTON = 'cursor-pointer rounded border px-3 py-1.5 text-[12px]'
const DANGER = `${BUTTON} border-tily-error text-tily-error hover:bg-tily-green-hover`
const SECONDARY = `${BUTTON} border-tily-line text-tily-ink hover:bg-tily-green-hover`

export function DeleteConfirmDialog({ request, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const title = `Supprimer « ${request.name} » ?`

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
  const handleConfirm = () => onConfirm(request)

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-tily-paper/60 pt-[12vh]" onPointerDown={handleBackdropPointerDown}>
      <div role="alertdialog" aria-label={title} className="flex w-[480px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={keepTabInside}>
        <div className="flex items-center justify-between gap-3 border-b border-tily-line px-4 py-3">
          <h2 className="min-w-0 truncate text-[15px] font-semibold text-tily-ink">{title}</h2>
        </div>
        <div className="flex flex-col gap-2 px-4 py-4">
          <p className="text-[12px] text-tily-ink">
            {request.isDirectory ? 'Le dossier et tout son contenu seront placés dans la corbeille de Windows.' : 'Le fichier sera placé dans la corbeille de Windows.'}
          </p>
          <p className="truncate font-mono text-[11px] text-tily-muted">{request.path}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-tily-line px-4 py-3">
          <button type="button" className={SECONDARY} data-tip="Échap" onClick={onCancel}>
            Annuler
          </button>
          <button ref={confirmRef} type="button" className={DANGER} data-tip="Entrée" onClick={handleConfirm}>
            Placer dans la corbeille
          </button>
        </div>
      </div>
    </div>
  )
}
