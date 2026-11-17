import type { ChangeEvent } from 'react'
import type { AmbianceSettings } from '../bridge/appearanceMessages'
import { AmbianceAlertFields } from './AmbianceAlertFields'
import { AmbianceBackgroundFields } from './AmbianceBackgroundFields'
import { AmbiancePreview } from './AmbiancePreview'
import { AmbianceTerminalFields } from './AmbianceTerminalFields'
import { SettingsField } from './SettingsField'
import { SettingsPanel } from './SettingsPanel'
import { SETTINGS_CHECKBOX } from './settingsStyles'

interface AmbianceSettingsSectionProps {
  title: string
  ambiance: AmbianceSettings
  onChange: (patch: Partial<AmbianceSettings>) => void
  onPickMedia: () => void
}

const SECTION_TIP = 'Fond animé, terminaux translucides et accent animé. L’aperçu suit vos réglages ; Tily les applique à l’enregistrement. La commande « Activer ou couper l’ambiance » la bascule à tout moment.'

export function AmbianceSettingsSection({ title, ambiance, onChange, onPickMedia }: AmbianceSettingsSectionProps) {
  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => onChange({ enabled: event.target.checked })

  return (
    <SettingsPanel title={title} tip={SECTION_TIP}>
      <AmbiancePreview ambiance={ambiance} />
      <SettingsField label="Ambiance">
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={ambiance.enabled} onChange={handleEnabledChange} />
          Activée
        </label>
      </SettingsField>
      {ambiance.enabled && (
        <>
          <AmbianceBackgroundFields ambiance={ambiance} onChange={onChange} onPickMedia={onPickMedia} />
          <AmbianceTerminalFields ambiance={ambiance} onChange={onChange} />
          <AmbianceAlertFields ambiance={ambiance} onChange={onChange} />
        </>
      )}
    </SettingsPanel>
  )
}
