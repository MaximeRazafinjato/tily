import { useState, type ChangeEvent } from 'react'
import { COMPANION_SIZE_MAX, COMPANION_SIZE_MIN, COMPANION_SPEED_MAX, COMPANION_SPEED_MIN, type AmbianceCompanions, type AmbianceSettings } from '../bridge/appearanceMessages'
import { requestShinyDemo } from '../companions/shinyDemo'
import { AmbianceSlider } from './AmbianceSlider'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SettingsField } from './SettingsField'
import { SETTINGS_CHECKBOX, SETTINGS_HINT, SETTINGS_ICON_BUTTON } from './settingsStyles'

interface AmbianceCompanionFieldsProps {
  ambiance: AmbianceSettings
  shinyEncounters: number
  onChange: (patch: Partial<AmbianceSettings>) => void
}

const TIP = 'Un compagnon par agent Claude Code, un plus petit par sous-agent. Il se pose sur la barre de statut, le haut des panes ou au-dessus d’un workspace ; on peut l’attraper, le lancer ou le ranger dans la bulle en bas à gauche. Un clic rejoint son pane. Chaque session et chaque sous-agent a une chance sur 512 d’avoir un compagnon chromatique : autres couleurs, reflets et étincelles.'
const SHINY_TEST = 'Faire apparaître un compagnon chromatique de démonstration, sans le compter'

export function AmbianceCompanionFields({ ambiance, shinyEncounters, onChange }: AmbianceCompanionFieldsProps) {
  const [demoRequested, setDemoRequested] = useState(false)
  const { companions } = ambiance
  const update = (patch: Partial<AmbianceCompanions>) => onChange({ companions: { ...companions, ...patch } })
  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => update({ enabled: event.target.checked })
  const handleSizeChange = (size: number) => update({ size })
  const handleSpeedChange = (speed: number) => update({ speed })
  const handleGoreChange = (event: ChangeEvent<HTMLInputElement>) => update({ gore: event.target.checked })
  const handleShinyTest = () => {
    requestShinyDemo()
    setDemoRequested(true)
  }
  return (
    <SettingsField label="Compagnons d’agents" tip={TIP}>
      <label className={SETTINGS_CHECKBOX}>
        <input type="checkbox" checked={companions.enabled} onChange={handleEnabledChange} />
        Afficher
      </label>
      {companions.enabled && (
        <>
          <AmbianceSlider label="Taille des compagnons" value={companions.size} min={COMPANION_SIZE_MIN} max={COMPANION_SIZE_MAX} unit=" px" onChange={handleSizeChange} />
          <AmbianceSlider label="Vitesse des compagnons" value={companions.speed} min={COMPANION_SPEED_MIN} max={COMPANION_SPEED_MAX} step={5} unit=" %" onChange={handleSpeedChange} />
          <label className={SETTINGS_CHECKBOX} data-tip="Un compagnon lancé fort contre un bord ou le sol s’écrase en éclaboussures ; secoué, il est étourdi, puis explose et se reforme.">
            <input type="checkbox" checked={companions.gore} onChange={handleGoreChange} />
            Mode gore
          </label>
          <span className="flex items-center gap-1.5 text-[12px] text-tily-ink">
            {`✦ Chromatiques rencontrés : ${shinyEncounters}`}
            <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={SHINY_TEST} data-tip={SHINY_TEST} onClick={handleShinyTest}>
              <Icon name={IconName.Play} />
            </button>
          </span>
          {demoRequested && <span className={SETTINGS_HINT}>Il apparaîtra à la fermeture des Paramètres, si les compagnons sont enregistrés comme affichés.</span>}
        </>
      )}
    </SettingsField>
  )
}
