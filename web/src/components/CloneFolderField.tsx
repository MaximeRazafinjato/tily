import { useState, type ChangeEvent } from 'react'
import type { ClonePlan } from '../bridge/cloneMessages'
import { changeCloneDraft, pickCloneFolder } from '../clone/cloneActions'
import type { CloneDraft } from '../store/cloneStore'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SETTINGS_BROWSE, SETTINGS_INPUT } from './settingsStyles'
import { WorktreePathLabel } from './WorktreePathLabel'

interface CloneFolderFieldProps {
  draft: CloneDraft
  plan: ClonePlan | null
  roots: string[]
}

const EDIT_LABEL = 'Modifier le dossier où cloner le dépôt'
const PICK_LABEL = 'Choisir le dossier où cloner le dépôt'
const ROOTS_LIST = 'clone-project-roots'

const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => changeCloneDraft({ folder: event.target.value })

export function CloneFolderField({ draft, plan, roots }: CloneFolderFieldProps) {
  const [editing, setEditing] = useState(false)
  const finalPath = plan?.path ?? plan?.pathPreview ?? plan?.folder ?? ''
  const handleEdit = () => setEditing(true)

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-h-[28px] min-w-0 items-center gap-2">
        <WorktreePathLabel path={finalPath} />
        {!editing && (
          <button type="button" className={`${SETTINGS_BROWSE} h-[24px]`} aria-label={EDIT_LABEL} data-tip={EDIT_LABEL} onClick={handleEdit}>
            <Icon name={IconName.Pencil} />
          </button>
        )}
      </span>
      {editing && (
        <span className="flex gap-1">
          <input type="text" className={SETTINGS_INPUT} value={draft.folder ?? plan?.folder ?? ''} list={ROOTS_LIST} spellCheck={false} autoFocus aria-label="Dossier où cloner le dépôt" onChange={handleFolderChange} />
          <datalist id={ROOTS_LIST}>
            {roots.map((root) => (
              <option key={root} value={root} />
            ))}
          </datalist>
          <button type="button" className={SETTINGS_BROWSE} aria-label={PICK_LABEL} data-tip={PICK_LABEL} onClick={pickCloneFolder}>
            <Icon name={IconName.More} />
          </button>
        </span>
      )}
      {plan?.error && <span className="text-[11px] text-tily-error">{plan.error}</span>}
    </div>
  )
}
