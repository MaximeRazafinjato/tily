import { useEffect, type ChangeEvent, type KeyboardEvent, type SubmitEvent } from 'react'
import {
  canCloseMergeRequest,
  canSubmitMergeRequest,
  changeMergeRequestDescription,
  changeMergeRequestTitle,
  closeMergeRequest,
  closeMergeRequestForm,
  disarmMergeRequestClose,
  setMergeRequestDraft,
  submitMergeRequest,
  toggleMergeRequestAssignee,
  toggleMergeRequestFormLabel,
  toggleMergeRequestReviewer,
} from '../forge/mergeRequestFormActions'
import { labelOptions, memberOptions, otherAssigneesNotice } from '../forge/mergeRequestFormOptions'
import { kindNoun } from '../forge/mergeRequestLabels'
import { MergeRequestFormMode, useMergeRequestFormStore } from '../store/mergeRequestFormStore'
import { keepTabInside } from './focusTrap'
import { ForgeChoicePicker } from './ForgeChoicePicker'
import { MergeRequestBranchFields } from './MergeRequestBranchFields'
import { SETTINGS_BUTTON, SETTINGS_HINT, SETTINGS_INPUT, SETTINGS_LABEL, SETTINGS_SECONDARY } from './settingsStyles'
import { Spinner } from './Spinner'

const PRIMARY = `${SETTINGS_BUTTON} flex items-center gap-2 border-tily-green text-tily-green-deep hover:bg-tily-green-soft disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent`
const CHECK_LABEL = 'flex items-center gap-2 text-[12px] text-tily-ink'
const DANGER = `${SETTINGS_BUTTON} mr-auto border-tily-error text-tily-error hover:bg-tily-green-hover disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent`

const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
  event.preventDefault()
  submitMergeRequest()
}

const handleFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
  if (event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault()
    submitMergeRequest()
    return
  }
  keepTabInside(event)
}

const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter' && !event.ctrlKey) {
    event.preventDefault()
  }
}

const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => changeMergeRequestTitle(event.target.value)
const handleDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => changeMergeRequestDescription(event.target.value)
const handleDraftChange = (event: ChangeEvent<HTMLInputElement>) => setMergeRequestDraft(event.target.checked)

export function MergeRequestDialog() {
  const form = useMergeRequestFormStore((state) => state.form)
  const open = form !== null

  useEffect(() => {
    if (!open) {
      return
    }
    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        closeMergeRequestForm()
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [open])

  if (!form) {
    return null
  }

  const { data, fields, submitting } = form
  const editing = form.mode === MergeRequestFormMode.Edit
  const noun = kindNoun(data?.forge.kind)
  const title = editing ? `Modifier la ${noun}${form.reference ? ` ${form.reference}` : ''}` : `Créer une ${noun}`
  const members = data ? memberOptions(data.members, data.currentUser) : []
  const labels = data ? labelOptions(data.labels) : []
  const assigneesNotice = otherAssigneesNotice(form)
  const submitLabel = editing ? (submitting ? 'Enregistrement…' : 'Enregistrer') : submitting ? 'Création…' : 'Créer'

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-tily-paper/60 pt-[6vh]">
      <form role="dialog" aria-label={title} className="flex max-h-[88vh] w-[680px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={handleFormKeyDown} onSubmit={handleSubmit}>
        <div className="flex items-center justify-between gap-3 border-b border-tily-line px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-[15px] font-semibold text-tily-ink">{title}</h2>
            {data && <span className={`${SETTINGS_HINT} truncate font-mono`}>{`${data.forge.host} · ${data.forge.project}`}</span>}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {!data && !form.loadError && (
            <span className={`${SETTINGS_HINT} flex items-center gap-2`}>
              <Spinner size={10} />
              Lecture du projet, des membres et des labels…
            </span>
          )}
          {form.loadError && <p className="text-[12px] break-words text-tily-error">{form.loadError}</p>}
          {data && (
            <>
              <MergeRequestBranchFields data={data} fields={fields} branch={form.branch} push={form.push} comparing={form.comparing} compareError={form.compareError} disabled={submitting} editing={editing} />
              <fieldset className="flex flex-col gap-3" disabled={submitting}>
                <label className="flex flex-col gap-1">
                  <span className={SETTINGS_LABEL}>Titre</span>
                  <input type="text" className={`${SETTINGS_INPUT} font-sans`} value={fields.title} autoFocus aria-required onChange={handleTitleChange} onKeyDown={handleTitleKeyDown} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={SETTINGS_LABEL}>Description</span>
                  <textarea className={`${SETTINGS_INPUT} min-h-[140px] resize-y`} value={fields.description} rows={8} spellCheck={false} onChange={handleDescriptionChange} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <ForgeChoicePicker label="Reviewers" options={members} selected={fields.reviewers} multiple emptyMessage="Aucun membre lu." disabled={submitting} onToggle={toggleMergeRequestReviewer} />
                  <div className="flex flex-col gap-1">
                    <ForgeChoicePicker label="Assigné" options={members} selected={fields.assignee ? [fields.assignee] : []} multiple={false} emptyMessage="Aucun membre lu." disabled={submitting} onToggle={toggleMergeRequestAssignee} />
                    {assigneesNotice && <span className={SETTINGS_HINT}>{assigneesNotice}</span>}
                  </div>
                </div>
                <ForgeChoicePicker label="Labels" options={labels} selected={fields.labels} multiple emptyMessage="Aucun label dans ce projet." disabled={submitting} onToggle={toggleMergeRequestFormLabel} />
                <label className={CHECK_LABEL}>
                  <input type="checkbox" checked={fields.draft} onChange={handleDraftChange} />
                  {editing ? 'Brouillon' : 'Créer en brouillon'}
                </label>
              </fieldset>
              {data.warnings.map((warning) => (
                <p key={warning} className="text-[11px] break-words text-tily-warning">
                  {warning}
                </p>
              ))}
            </>
          )}
          {form.submitError && <p className="text-[12px] break-words text-tily-error">{form.submitError}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-tily-line px-4 py-3">
          {editing && (
            <button type="button" className={DANGER} disabled={!canCloseMergeRequest(form)} onClick={closeMergeRequest} onBlur={disarmMergeRequestClose}>
              {form.closeArmed ? 'Confirmer la fermeture' : `Fermer la ${noun}`}
            </button>
          )}
          <button type="button" className={SETTINGS_SECONDARY} data-tip="Échap" onClick={closeMergeRequestForm}>
            {submitting ? 'Fermer' : 'Annuler'}
          </button>
          <button type="submit" className={PRIMARY} disabled={!canSubmitMergeRequest(form)} data-tip="Ctrl+Entrée">
            {submitting && <Spinner size={10} className="text-tily-green" />}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
