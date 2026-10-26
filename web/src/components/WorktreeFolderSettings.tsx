import type { ChangeEvent } from 'react'
import type { WorktreeProjectFolder, WorktreeSettings } from '../bridge/worktreeMessages'
import { folderName } from '../model/session'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SettingsField } from './SettingsField'
import { SETTINGS_BROWSE, SETTINGS_HINT, SETTINGS_INPUT, SETTINGS_LABEL } from './settingsStyles'

interface WorktreeFolderSettingsProps {
  worktrees: WorktreeSettings
  folders: WorktreeProjectFolder[]
  projectsRoot: string
  onChange: (patch: Partial<WorktreeSettings>) => void
  onFoldersChange: (folders: WorktreeProjectFolder[]) => void
  onPickFolder: () => void
}

const PATH_SEPARATOR = '\\'
const FOLDER_ID = 'settings-worktree-folder'
const REMOVE = 'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink'

export function WorktreeFolderSettings({ worktrees, folders, projectsRoot, onChange, onFoldersChange, onPickFolder }: WorktreeFolderSettingsProps) {
  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => onChange({ folder: event.target.value })

  return (
    <>
      <SettingsField label="Dossier des worktrees" tip="Vide : sous-dossier « worktrees » du dossier des projets, comme wtr. Chaque worktree y est créé sous le nom « projet-branche »." htmlFor={FOLDER_ID}>
        <span className="flex gap-1">
          <input id={FOLDER_ID} type="text" className={SETTINGS_INPUT} value={worktrees.folder} placeholder={`${projectsRoot}${PATH_SEPARATOR}worktrees`} spellCheck={false} onChange={handleFolderChange} />
          <button type="button" className={SETTINGS_BROWSE} aria-label="Choisir le dossier des worktrees" data-tip="Choisir le dossier des worktrees" onClick={onPickFolder}>
            <Icon name={IconName.More} />
          </button>
        </span>
      </SettingsField>
      {folders.length > 0 && (
        <SettingsField label="Par projet" tip="Dossiers des worktrees mémorisés à la création d’un worktree, par la case « Mémoriser pour <projet> ». Retirés à l’enregistrement.">
          <ul className="flex flex-col">
            {folders.map((entry) => {
              const handleRemove = () => onFoldersChange(folders.filter((candidate) => candidate !== entry))
              const removeLabel = `Retirer le dossier de ${folderName(entry.project)}`
              return (
                <li key={entry.project} className="flex items-center gap-2">
                  <span className={`${SETTINGS_LABEL} shrink-0`} data-tip={entry.project}>
                    {folderName(entry.project)}
                  </span>
                  <span className={`${SETTINGS_HINT} min-w-0 flex-1 truncate font-mono`} data-tip={entry.folder}>
                    {entry.folder}
                  </span>
                  <button type="button" className={REMOVE} aria-label={removeLabel} data-tip={removeLabel} onClick={handleRemove}>
                    <Icon name={IconName.Close} />
                  </button>
                </li>
              )
            })}
          </ul>
        </SettingsField>
      )}
    </>
  )
}
