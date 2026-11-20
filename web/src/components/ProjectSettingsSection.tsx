import type { ChangeEvent } from 'react'
import type { WorktreeProjectFolder, WorktreeSettings } from '../bridge/worktreeMessages'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { ProjectRootsSettings } from './ProjectRootsSettings'
import { SettingsField } from './SettingsField'
import { SettingsPanel } from './SettingsPanel'
import { SETTINGS_BROWSE, SETTINGS_CHECKBOX, SETTINGS_INPUT } from './settingsStyles'
import { WorktreeFolderSettings } from './WorktreeFolderSettings'

interface ProjectSettingsSectionProps {
  title: string
  projectsRoot: string
  additionalProjectsRoots: string[]
  worktrees: WorktreeSettings
  worktreeFolders: WorktreeProjectFolder[]
  autoFetch: boolean
  onProjectsRootChange: (projectsRoot: string) => void
  onAdditionalProjectsRootsChange: (roots: string[]) => void
  onWorktreesChange: (patch: Partial<WorktreeSettings>) => void
  onWorktreeFoldersChange: (folders: WorktreeProjectFolder[]) => void
  onAutoFetchChange: (autoFetch: boolean) => void
  onPickProjectsRoot: () => void
  onPickAdditionalProjectsRoot: () => void
  onPickWorktreeFolder: () => void
}

const PROJECTS_ROOT_ID = 'settings-projects-root'
const DEFAULT_BASE_ID = 'settings-default-base'
const PICK_PROJECTS_ROOT = 'Choisir le dossier des projets'

export function ProjectSettingsSection({ title, projectsRoot, additionalProjectsRoots, worktrees, worktreeFolders, autoFetch, onProjectsRootChange, onAdditionalProjectsRootsChange, onWorktreesChange, onWorktreeFoldersChange, onAutoFetchChange, onPickProjectsRoot, onPickAdditionalProjectsRoot, onPickWorktreeFolder }: ProjectSettingsSectionProps) {
  const handleProjectsRootChange = (event: ChangeEvent<HTMLInputElement>) => onProjectsRootChange(event.target.value)
  const handleDefaultBaseChange = (event: ChangeEvent<HTMLInputElement>) => onWorktreesChange({ defaultBase: event.target.value })
  const handleAutoFetchChange = (event: ChangeEvent<HTMLInputElement>) => onAutoFetchChange(event.target.checked)

  return (
    <SettingsPanel title={title}>
      <SettingsField label="Dossier des projets" tip="Ses dossiers de premier niveau sont listés par le sélecteur de projets, hors « worktrees » et dossiers cachés." htmlFor={PROJECTS_ROOT_ID}>
        <span className="flex gap-1">
          <input id={PROJECTS_ROOT_ID} type="text" className={SETTINGS_INPUT} value={projectsRoot} spellCheck={false} onChange={handleProjectsRootChange} />
          <button type="button" className={SETTINGS_BROWSE} aria-label={PICK_PROJECTS_ROOT} data-tip={PICK_PROJECTS_ROOT} onClick={onPickProjectsRoot}>
            <Icon name={IconName.More} />
          </button>
        </span>
      </SettingsField>
      <ProjectRootsSettings roots={additionalProjectsRoots} onChange={onAdditionalProjectsRootsChange} onPick={onPickAdditionalProjectsRoot} />
      <WorktreeFolderSettings worktrees={worktrees} folders={worktreeFolders} projectsRoot={projectsRoot} onChange={onWorktreesChange} onFoldersChange={onWorktreeFoldersChange} onPickFolder={onPickWorktreeFolder} />
      <SettingsField label="Base par défaut" tip="Branche de départ proposée à la création d’un worktree, récupérée par un fetch sur origin juste avant." htmlFor={DEFAULT_BASE_ID}>
        <input id={DEFAULT_BASE_ID} type="text" className={SETTINGS_INPUT} value={worktrees.defaultBase} spellCheck={false} onChange={handleDefaultBaseChange} />
      </SettingsField>
      <SettingsField label="Fetch automatique" tip="Lance git fetch --all à l’ouverture de la vue Git et quand le pane actif passe à un autre dépôt, au plus une fois toutes les 5 minutes par dépôt. Un échec (hors ligne, authentification) reste silencieux.">
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={autoFetch} onChange={handleAutoFetchChange} />
          À l’ouverture de la vue Git
        </label>
      </SettingsField>
    </SettingsPanel>
  )
}
