import type { ChangeEvent } from 'react'
import type { AmbianceSettings } from '../bridge/appearanceMessages'
import { AmbianceSlider } from './AmbianceSlider'
import { SettingsField } from './SettingsField'
import { SETTINGS_CHECKBOX } from './settingsStyles'

interface AmbianceInterfaceFieldsProps {
  ambiance: AmbianceSettings
  onChange: (patch: Partial<AmbianceSettings>) => void
}

const VEIL_TIP = 'Opacité des barres et panneaux par-dessus le fond : 0 % les rend transparents, 100 % les rend opaques comme sans ambiance.'

export function AmbianceInterfaceFields({ ambiance, onChange }: AmbianceInterfaceFieldsProps) {
  const handleVeilChange = (interfaceVeil: number) => onChange({ interfaceVeil })
  const handleAccentChange = (event: ChangeEvent<HTMLInputElement>) => onChange({ animatedAccent: event.target.checked })

  return (
    <>
      {ambiance.background.enabled && (
        <SettingsField label="Voile" tip={VEIL_TIP}>
          <AmbianceSlider label="Voile de l’interface" value={ambiance.interfaceVeil} min={0} max={100} unit=" %" onChange={handleVeilChange} />
        </SettingsField>
      )}
      <SettingsField label="Accent">
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={ambiance.animatedAccent} onChange={handleAccentChange} />
          Animer la couleur de Tily avec l’ambiance
        </label>
      </SettingsField>
    </>
  )
}
