import { useState, type ChangeEvent } from 'react'
import type { WorktreePlan } from '../bridge/worktreeMessages'
import { folderName } from '../model/session'
import type { WorktreeDraft } from '../store/worktreeStore'
import { changeWorktreeDraft, changeWorktreeFolder, folderChanged, pickWorktreeFolder } from '../worktree/worktreeActions'
import { parentFolder } from '../worktree/worktreePaths'
import { SETTINGS_BROWSE, SETTINGS_INPUT } from './settingsStyles'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface WorktreeFolderFieldProps {
  draft: WorktreeDraft
  plan: WorktreePlan | null
  project: string
  checkboxLabel: string
}

const EDIT_LABEL = 'Modifier le dossier des worktrees'

const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => changeWorktreeFolder(event.target.value)
const handleRememberFolderChange = (event: ChangeEvent<HTMLInputElement>) => changeWorktreeDraft({ rememberFolder: event.target.checked })

export function WorktreeFolderField({ draft, plan, project, checkboxLabel }: WorktreeFolderFieldProps) {
  const [editing, setEditing] = useState(false)
  const changed = folderChanged(draft, plan)
  const expanded = editing || changed
  const finalPath = plan?.path ?? plan?.pathPreview ?? ''
  const handleEdit = () => setEditing(true)

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-h-[28px] min-w-0 items-center gap-2">
        <span className="flex min-w-0 flex-1 items-baseline gap-2 text-[12px]" data-tip={finalPath || undefined}>
          <span className="shrink-0 text-tily-ink">{finalPath ? folderName(finalPath) : '—'}</span>
          <span className="truncate text-[11px] text-tily-muted">{parentFolder(finalPath)}</span>
        </span>
        {!expanded && (
          <button type="button" className={`${SETTINGS_BROWSE} h-[24px]`} aria-label={EDIT_LABEL} data-tip={EDIT_LABEL} onClick={handleEdit}>
            <Icon name={IconName.Pencil} />
          </button>
        )}
      </span>
      {expanded && (
        <>
          <span className="flex gap-1">
            <input type="text" className={SETTINGS_INPUT} value={draft.folder ?? plan?.folder ?? ''} spellCheck={false} autoFocus={editing} aria-label="Dossier des worktrees" onChange={handleFolderChange} />
            <button type="button" className={SETTINGS_BROWSE} aria-label="Choisir le dossier des worktrees" data-tip="Choisir le dossier des worktrees" onClick={pickWorktreeFolder}>
              <Icon name={IconName.More} />
            </button>
          </span>
          {changed && (
            <label className={checkboxLabel}>
              <input type="checkbox" checked={draft.rememberFolder} onChange={handleRememberFolderChange} />
              {`Mémoriser pour ${project}`}
            </label>
          )}
        </>
      )}
      {plan?.error && <span className="text-[11px] text-tily-error">{plan.error}</span>}
    </div>
  )
}
