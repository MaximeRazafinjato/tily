import type { AppearanceSettings } from '../bridge/messages'
import { folderName } from '../model/session'
import { useAppearanceStore } from '../store/appearanceStore'
import { AccentSwatches } from './AccentSwatches'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SettingsField } from './SettingsField'
import { SettingsPanel } from './SettingsPanel'
import { SETTINGS_HINT, SETTINGS_ICON_BUTTON } from './settingsStyles'

interface AppearanceSettingsSectionProps {
  title: string
  appearance: AppearanceSettings
  onChange: (patch: Partial<AppearanceSettings>) => void
}

const ACCENT_TIP = 'Accents, fonds légèrement teintés, terminaux et barre de titre de toute l’application.'
const PROJECTS_TIP = 'Choisies depuis le menu d’un workspace, « Couleur… ». Elles surlignent le nom de tout workspace dont le pane actif est dans le projet, worktrees compris.'

export function AppearanceSettingsSection({ title, appearance, onChange }: AppearanceSettingsSectionProps) {
  const presets = useAppearanceStore((store) => store.accentPresets)
  const defaultColor = useAppearanceStore((store) => store.state?.defaultColor ?? '')
  const projects = Object.entries(appearance.projectColors).sort(([first], [second]) => folderName(first).localeCompare(folderName(second)))

  const handleAccentChange = (accent: string | undefined) => onChange({ accent })

  return (
    <SettingsPanel title={title}>
      <SettingsField label="Couleur de Tily" tip={ACCENT_TIP}>
        <AccentSwatches presets={presets} value={appearance.accent} fallback={defaultColor} fallbackLabel="Par défaut" onChange={handleAccentChange} />
      </SettingsField>
      <SettingsField label="Couleurs des projets" tip={PROJECTS_TIP}>
        {projects.length === 0 && <span className={SETTINGS_HINT}>Aucune.</span>}
        {projects.map(([project, color]) => {
          const remove = `Retirer la couleur de ${folderName(project)}`
          const handleRemove = () => onChange({ projectColors: Object.fromEntries(Object.entries(appearance.projectColors).filter(([candidate]) => candidate !== project)) })
          return (
            <span key={project} className="flex items-center gap-2">
              <span className="h-4 w-4 shrink-0 rounded-full border border-tily-line" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-tily-ink" data-tip={project}>
                {folderName(project)}
              </span>
              <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={remove} data-tip={remove} onClick={handleRemove}>
                <Icon name={IconName.Close} />
              </button>
            </span>
          )
        })}
      </SettingsField>
    </SettingsPanel>
  )
}
