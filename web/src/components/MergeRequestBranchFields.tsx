import type { ChangeEvent, MouseEvent } from 'react'
import type { MergeRequestBranchInfo, MergeRequestFormData, MergeRequestInput } from '../bridge/forgeMessages'
import { openMergeRequest } from '../forge/mergeRequestActions'
import { changeMergeRequestBranches, setMergeRequestPush } from '../forge/mergeRequestFormActions'
import { commitsNotice, publicationNotice } from '../forge/mergeRequestFormOptions'
import { kindNoun, MERGE_REQUEST_LINK_HINT } from '../forge/mergeRequestLabels'
import { SETTINGS_HINT, SETTINGS_INPUT, SETTINGS_LABEL } from './settingsStyles'
import { Spinner } from './Spinner'

interface MergeRequestBranchFieldsProps {
  data: MergeRequestFormData
  fields: MergeRequestInput
  branch: MergeRequestBranchInfo | null
  push: boolean
  comparing: boolean
  compareError: string | null
  disabled: boolean
  editing: boolean
}

const CHECK_LABEL = 'flex items-center gap-2 text-[12px] text-tily-ink'

const withValue = (branches: string[], value: string): string[] => (value && !branches.includes(value) ? [value, ...branches] : branches)

const handleSourceChange = (event: ChangeEvent<HTMLSelectElement>) => changeMergeRequestBranches({ sourceBranch: event.target.value })
const handleTargetChange = (event: ChangeEvent<HTMLSelectElement>) => changeMergeRequestBranches({ targetBranch: event.target.value })
const handlePushChange = (event: ChangeEvent<HTMLInputElement>) => setMergeRequestPush(event.target.checked)

export function MergeRequestBranchFields({ data, fields, branch, push, comparing, compareError, disabled, editing }: MergeRequestBranchFieldsProps) {
  const noun = kindNoun(data.forge.kind)
  const pushNotice = branch ? publicationNotice(branch) : null
  const existing = editing ? undefined : branch?.existing[0]
  const handleOpenExisting = (event: MouseEvent) => {
    if (existing) {
      openMergeRequest(existing.url, event.shiftKey)
    }
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className={SETTINGS_LABEL}>Branche source</span>
          <select className={`${SETTINGS_INPUT} disabled:opacity-60`} value={fields.sourceBranch} disabled={editing} onChange={handleSourceChange}>
            {withValue(data.sourceBranches, fields.sourceBranch).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <span className="pb-[7px] text-[12px] text-tily-muted" aria-hidden>
          →
        </span>
        <label className="flex min-w-0 flex-col gap-1">
          <span className={SETTINGS_LABEL}>Branche cible</span>
          <select className={SETTINGS_INPUT} value={fields.targetBranch} onChange={handleTargetChange}>
            {!fields.targetBranch && <option value="">Choisir une branche…</option>}
            {withValue(data.targetBranches, fields.targetBranch).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex min-h-[18px] flex-col gap-1">
        {comparing && (
          <span className={`${SETTINGS_HINT} flex items-center gap-2`}>
            <Spinner size={10} />
            Comparaison des branches…
          </span>
        )}
        {!comparing && compareError && <span className="text-[11px] text-tily-error">{compareError}</span>}
        {!comparing && branch?.error && <span className="text-[11px] text-tily-error">{branch.error}</span>}
        {!comparing && branch && !branch.error && <span className={SETTINGS_HINT}>{commitsNotice(branch)}</span>}
        {!comparing && existing && (
          <span className="text-[11px] text-tily-warning">
            {`Une ${noun} est déjà ouverte depuis cette branche : `}
            <button type="button" className="cursor-pointer underline" data-tip={MERGE_REQUEST_LINK_HINT} onClick={handleOpenExisting}>
              {`${existing.reference} ${existing.title}`}
            </button>
          </span>
        )}
        {pushNotice && (
          <>
            <span className="text-[11px] text-tily-warning">{pushNotice}</span>
            <label className={CHECK_LABEL}>
              <input type="checkbox" checked={push} onChange={handlePushChange} />
              {editing ? 'Pousser la branche avant d’enregistrer' : 'Pousser la branche avant de créer'}
            </label>
          </>
        )}
      </div>
    </fieldset>
  )
}
