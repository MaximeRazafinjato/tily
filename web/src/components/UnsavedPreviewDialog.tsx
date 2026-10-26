import { useEffect, useRef, type PointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { folderName } from '../model/session'
import { cancelPendingAction, discardBeforePendingAction, saveBeforePendingAction } from '../preview/previewEdit'
import { usePreviewStore } from '../store/previewStore'
import { keepTabInside } from './focusTrap'

const BUTTON = 'cursor-pointer rounded border px-3 py-1.5 text-[12px] aria-disabled:cursor-default aria-disabled:opacity-50'
const PRIMARY = `${BUTTON} border-tily-green text-tily-green-deep hover:bg-tily-green-soft`
const DANGER = `${BUTTON} border-tily-error text-tily-error hover:bg-tily-green-hover`
const SECONDARY = `${BUTTON} border-tily-line text-tily-ink hover:bg-tily-green-hover`

const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
  if (event.target === event.currentTarget) {
    cancelPendingAction()
  }
}

export function UnsavedPreviewDialog() {
  const { path, saving } = usePreviewStore(useShallow((store) => ({ path: store.path, saving: store.edit?.saving ?? false })))
  const saveRef = useRef<HTMLButtonElement>(null)
  const title = `Enregistrer « ${path ? folderName(path) : ''} » ?`

  useEffect(() => {
    saveRef.current?.focus()
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelPendingAction()
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [])

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-tily-paper/60 pt-[12vh]" onPointerDown={handleBackdropPointerDown}>
      <div role="alertdialog" aria-label={title} className="flex w-[480px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={keepTabInside}>
        <div className="flex items-center justify-between gap-3 border-b border-tily-line px-4 py-3">
          <h2 className="min-w-0 truncate text-[15px] font-semibold text-tily-ink">{title}</h2>
        </div>
        <div className="flex flex-col gap-2 px-4 py-4">
          <p className="text-[12px] text-tily-ink">Le fichier contient des modifications non enregistrées.</p>
          <p className="truncate text-[11px] text-tily-muted">{path}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-tily-line px-4 py-3">
          <button type="button" className={SECONDARY} data-tip="Échap" onClick={cancelPendingAction}>
            Annuler
          </button>
          <button type="button" className={DANGER} onClick={discardBeforePendingAction}>
            Abandonner les modifications
          </button>
          <button ref={saveRef} type="button" className={PRIMARY} aria-disabled={saving} onClick={saveBeforePendingAction}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
