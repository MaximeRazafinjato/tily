import type { ChangeEvent } from 'react'
import { COMPANION_SIZE_MAX, COMPANION_SIZE_MIN, COMPANION_SPEED_MAX, COMPANION_SPEED_MIN, type AmbianceCompanions, type AmbianceSettings } from '../bridge/appearanceMessages'
import { AmbianceSlider } from './AmbianceSlider'
import { SettingsField } from './SettingsField'
import { SETTINGS_CHECKBOX } from './settingsStyles'

interface AmbianceCompanionFieldsProps {
  ambiance: AmbianceSettings
  onChange: (patch: Partial<AmbianceSettings>) => void
}

const TIP = 'Un compagnon par agent Claude Code, un plus petit par sous-agent. Il se pose sur la barre de statut, la barre d’onglets ou le haut des panneaux ; on peut l’attraper, le lancer ou le ranger dans la bulle en bas à gauche. Un clic rejoint son pane.'

export function AmbianceCompanionFields({ ambiance, onChange }: AmbianceCompanionFieldsProps) {
  const { companions } = ambiance
  const update = (patch: Partial<AmbianceCompanions>) => onChange({ companions: { ...companions, ...patch } })
  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => update({ enabled: event.target.checked })
  const handleSizeChange = (size: number) => update({ size })
  const handleSpeedChange = (speed: number) => update({ speed })
  const handleGoreChange = (event: ChangeEvent<HTMLInputElement>) => update({ gore: event.target.checked })
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
        </>
      )}
    </SettingsField>
  )
}
