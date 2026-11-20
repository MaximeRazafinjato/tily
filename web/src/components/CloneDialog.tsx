import { useEffect, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent, type SubmitEvent } from 'react'
import type { ClonePlan } from '../bridge/cloneMessages'
import { changeCloneDraft, closeCloneDialog, submitClone } from '../clone/cloneActions'
import type { CloneDraft, CloneFailure } from '../store/cloneStore'
import { CloneFolderField } from './CloneFolderField'
import { keepTabInside } from './focusTrap'
import { InfoTip } from './InfoTip'
import { SETTINGS_BUTTON, SETTINGS_INPUT, SETTINGS_SECONDARY } from './settingsStyles'
import { Spinner } from './Spinner'
import { WorktreeFailureDetails } from './WorktreeFailureDetails'

interface CloneDialogProps {
  draft: CloneDraft
  plan: ClonePlan | null
  roots: string[]
  planPending: boolean
  busy: boolean
  failure: CloneFailure | null
}

const PRIMARY = `${SETTINGS_BUTTON} flex items-center gap-2 border-tily-green text-tily-green-deep hover:bg-tily-green-soft disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent`
const CHECKBOX_LABEL = 'flex items-center gap-2 text-[12px] text-tily-ink'
const ROW_LABEL = 'flex min-h-[28px] items-center text-[12px] text-tily-muted'
const SUBMIT_TIP = 'Entrée : nouveau workspace · Maj+Entrée : nouvel onglet dans le workspace actif'

const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
  event.preventDefault()
  submitClone(false)
}

const handleFormKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
  if (event.key === 'Enter' && event.shiftKey && !event.nativeEvent.isComposing && event.target instanceof HTMLInputElement && event.target.type === 'text') {
    event.preventDefault()
    submitClone(true)
    return
  }
  keepTabInside(event)
}

const handleSubmitClick = (event: MouseEvent<HTMLButtonElement>) => {
  if (event.shiftKey) {
    event.preventDefault()
    submitClone(true)
  }
}

const handleUrlChange = (event: ChangeEvent<HTMLInputElement>) => changeCloneDraft({ url: event.target.value })
const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => changeCloneDraft({ name: event.target.value })
const handleClaudeChange = (event: ChangeEvent<HTMLInputElement>) => changeCloneDraft({ claude: event.target.checked })
const handleInstallChange = (event: ChangeEvent<HTMLInputElement>) => changeCloneDraft({ install: event.target.checked })

export function CloneDialog({ draft, plan, roots, planPending, busy, failure }: CloneDialogProps) {
  const canClone = Boolean(plan?.path) && !plan?.error && !planPending && !busy
  const guarded = draft.url.trim().length > 0
  const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !guarded) {
      closeCloneDialog()
    }
  }
  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && guarded) {
      event.preventDefault()
    }
  }

  useEffect(() => {
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeCloneDialog()
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [])

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-tily-paper/60 pt-[10vh]" onPointerDown={handleBackdropPointerDown} onMouseDown={handleBackdropMouseDown}>
      <form role="dialog" aria-label="Cloner un dépôt" className="flex max-h-[80vh] w-[560px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={handleFormKeyDown} onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 border-b border-tily-line px-4 py-3">
          <h2 className="text-[15px] font-semibold text-tily-ink">Cloner un dépôt</h2>
          <InfoTip text="git clone avec la configuration et le gestionnaire d’identifiants de Git, puis ouverture du dépôt dans un nouveau workspace, ou dans un nouvel onglet du workspace actif par Maj + Entrée." />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-4 overflow-y-auto px-4 py-4">
          <span className={ROW_LABEL}>Adresse</span>
          <fieldset className="min-w-0" disabled={busy}>
            <input type="text" className={SETTINGS_INPUT} value={draft.url} placeholder="https://github.com/organisation/depot.git" spellCheck={false} autoFocus aria-label="Adresse du dépôt" onChange={handleUrlChange} />
          </fieldset>
          <span className={ROW_LABEL}>Nom</span>
          <fieldset className="min-w-0" disabled={busy}>
            <input type="text" className={SETTINGS_INPUT} value={draft.name} placeholder={plan?.name || 'Nom du dossier'} spellCheck={false} aria-label="Nom du dossier du dépôt" onChange={handleNameChange} />
          </fieldset>
          <span className={ROW_LABEL}>Dossier</span>
          <fieldset className="min-w-0" disabled={busy}>
            <CloneFolderField draft={draft} plan={plan} roots={roots} />
          </fieldset>
          <span className={ROW_LABEL}>Options</span>
          <fieldset className="min-w-0" disabled={busy}>
            <div className="flex min-h-[28px] flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5">
                <label className={CHECKBOX_LABEL}>
                  <input type="checkbox" checked={draft.claude} onChange={handleClaudeChange} />
                  Claude Code
                </label>
                <InfoTip text="claude démarre dans le terminal du dépôt ; pnpm install tourne alors dans un pane en dessous." />
              </span>
              <span className="flex items-center gap-1.5">
                <label className={CHECKBOX_LABEL}>
                  <input type="checkbox" checked={draft.install} onChange={handleInstallChange} />
                  pnpm install
                </label>
                <InfoTip text="Lancé dans le terminal du dépôt, si package.json existe." />
              </span>
            </div>
          </fieldset>
          {failure && (
            <div className="col-span-2">
              <WorktreeFailureDetails failure={failure} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-tily-line px-4 py-3">
          <button type="button" className={SETTINGS_SECONDARY} data-tip="Échap" onClick={closeCloneDialog}>
            {busy ? 'Fermer' : 'Annuler'}
          </button>
          <button type="submit" className={PRIMARY} disabled={!canClone} data-tip={SUBMIT_TIP} onClick={handleSubmitClick}>
            {busy && <Spinner size={10} className="text-tily-green" />}
            {busy ? 'Clonage…' : 'Cloner'}
          </button>
        </div>
      </form>
    </div>
  )
}
