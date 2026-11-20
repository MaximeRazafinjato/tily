import { folderName } from '../model/session'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SettingsField } from './SettingsField'
import { SETTINGS_HINT, SETTINGS_ICON_BUTTON, SETTINGS_LABEL } from './settingsStyles'

interface ProjectRootsSettingsProps {
  roots: string[]
  onChange: (roots: string[]) => void
  onPick: () => void
}

const TIP = 'Leurs dossiers de premier niveau sont aussi listés par le sélecteur de projets, hors « worktrees » et dossiers cachés.'
const ADD = 'Ajouter un dossier des projets'

export function ProjectRootsSettings({ roots, onChange, onPick }: ProjectRootsSettingsProps) {
  return (
    <SettingsField label="Autres dossiers" tip={TIP}>
      {roots.map((root) => {
        const remove = `Retirer ${root}`
        const handleRemove = () => onChange(roots.filter((candidate) => candidate !== root))
        return (
          <span key={root} className="flex items-center gap-2">
            <span className={`${SETTINGS_LABEL} shrink-0`}>{folderName(root)}</span>
            <span className={`${SETTINGS_HINT} min-w-0 flex-1 truncate`}>{root}</span>
            <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={remove} data-tip={remove} onClick={handleRemove}>
              <Icon name={IconName.Close} />
            </button>
          </span>
        )
      })}
      <span className="flex items-center gap-2">
        <span className={`${SETTINGS_HINT} min-w-0 flex-1`}>{roots.length === 0 ? 'Aucun.' : ''}</span>
        <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={ADD} data-tip={ADD} onClick={onPick}>
          <Icon name={IconName.Plus} />
        </button>
      </span>
    </SettingsField>
  )
}
