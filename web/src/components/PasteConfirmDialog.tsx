import { useEffect, useRef, type PointerEvent } from 'react'
import { usePasteStore, type PasteRequest } from '../store/pasteStore'
import { cancelPaste, confirmPaste } from '../terminal/terminalActions'
import { keepTabInside } from './focusTrap'

const PREVIEW_LINES = 8
const BUTTON = 'cursor-pointer rounded border px-3 py-1.5 text-[12px]'
const PRIMARY = `${BUTTON} border-tily-green text-tily-green-deep hover:bg-tily-green-soft`
const SECONDARY = `${BUTTON} border-tily-line text-tily-ink hover:bg-tily-green-hover`

const hiddenLinesLabel = (hidden: number): string => (hidden === 1 ? '… et 1 autre ligne' : `… et ${hidden} autres lignes`)

function PasteConfirmContent({ request }: { request: PasteRequest }) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const title = `Coller ${request.lines.length} lignes ?`
  const hidden = request.lines.length - PREVIEW_LINES

  useEffect(() => {
    confirmRef.current?.focus()
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelPaste()
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [])

  const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      cancelPaste()
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-tily-paper/60 pt-[12vh]" onPointerDown={handleBackdropPointerDown}>
      <div role="alertdialog" aria-label={title} className="flex max-h-[76vh] w-[560px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={keepTabInside}>
        <div className="flex items-baseline justify-between border-b border-tily-line px-4 py-3">
          <h2 className="text-[15px] font-semibold text-tily-ink">{title}</h2>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          <p className="text-[12px] text-tily-warning">Ce shell n’attend pas Entrée : chaque ligne collée s’exécute dès qu’elle arrive.</p>
          <pre className="overflow-x-auto rounded border border-tily-line bg-tily-terminal px-3 py-2 font-mono text-[12px] text-tily-terminal-ink">
            {request.lines.slice(0, PREVIEW_LINES).join('\n')}
          </pre>
          {hidden > 0 && <p className="text-[11px] text-tily-muted">{hiddenLinesLabel(hidden)}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-tily-line px-4 py-3">
          <button type="button" className={SECONDARY} data-tip="Échap" onClick={cancelPaste}>
            Annuler
          </button>
          <button ref={confirmRef} type="button" className={PRIMARY} data-tip="Entrée" onClick={confirmPaste}>
            Coller et exécuter
          </button>
        </div>
      </div>
    </div>
  )
}

export function PasteConfirmDialog() {
  const request = usePasteStore((state) => state.request)
  return request ? <PasteConfirmContent request={request} /> : null
}
