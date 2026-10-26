import type { ChangeEvent } from 'react'
import type { WorktreeProjectFolder, WorktreeSettings } from '../bridge/worktreeMessages'
import { folderName } from '../model/session'
import { InfoTip } from './InfoTip'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SETTINGS_BROWSE, SETTINGS_HINT, SETTINGS_INPUT, SETTINGS_LABEL, SETTINGS_ROW, SETTINGS_SECONDARY } from './settingsStyles'

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

export function WorktreeFolderSettings({ worktrees, folders, projectsRoot, onChange, onFoldersChange, onPickFolder }: WorktreeFolderSettingsProps) {
  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => onChange({ folder: event.target.value })

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className={SETTINGS_ROW}>
          <label htmlFor={FOLDER_ID} className={SETTINGS_LABEL}>
            Dossier des worktrees
          </label>
          <InfoTip text="Vide : sous-dossier « worktrees » du dossier des projets, comme wtr. Chaque worktree y est créé sous le nom « projet-branche »." />
        </span>
        <span className="flex gap-1">
          <input id={FOLDER_ID} type="text" className={SETTINGS_INPUT} value={worktrees.folder} placeholder={`${projectsRoot}${PATH_SEPARATOR}worktrees`} spellCheck={false} onChange={handleFolderChange} />
          <button type="button" className={SETTINGS_BROWSE} aria-label="Choisir le dossier des worktrees" data-tip="Choisir le dossier des worktrees" onClick={onPickFolder}>
            <Icon name={IconName.More} />
          </button>
        </span>
      </div>
      {folders.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={SETTINGS_ROW}>
            <span className={SETTINGS_LABEL}>Dossiers des worktrees par projet</span>
            <InfoTip text="Mémorisés à la création d’un worktree, par la case « Mémoriser pour les prochains worktrees »." />
          </span>
          <ul className="flex flex-col gap-1">
            {folders.map((entry) => {
              const handleRemove = () => onFoldersChange(folders.filter((candidate) => candidate !== entry))
              return (
                <li key={entry.project} className="flex items-center gap-2">
                  <span className={`${SETTINGS_LABEL} shrink-0`} data-tip={entry.project}>
                    {folderName(entry.project)}
                  </span>
                  <span className={`${SETTINGS_HINT} min-w-0 flex-1 truncate font-mono`} data-tip={entry.folder}>
                    {entry.folder}
                  </span>
                  <button type="button" className={SETTINGS_SECONDARY} data-tip="Les prochains worktrees de ce projet reviendront au dossier ci-dessus" onClick={handleRemove}>
                    Retirer
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
