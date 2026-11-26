import { useState, type ChangeEvent } from 'react'
import type { AmbianceSettings } from '../bridge/appearanceMessages'
import { AmbianceAlertFields } from './AmbianceAlertFields'
import { AmbianceCompanionFields } from './AmbianceCompanionFields'
import { AmbianceBackgroundFields } from './AmbianceBackgroundFields'
import { AmbianceInterfaceFields } from './AmbianceInterfaceFields'
import { AmbiancePerformanceFields } from './AmbiancePerformanceFields'
import { AmbiancePreview } from './AmbiancePreview'
import { AmbianceTerminalFields } from './AmbianceTerminalFields'
import { SettingsField } from './SettingsField'
import { SettingsGroupTitle } from './SettingsGroupTitle'
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
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => onChange({ enabled: event.target.checked })
  const handleAdvancedToggle = () => setAdvancedOpen((open) => !open)

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
          <SettingsGroupTitle title="Fond" />
          <AmbianceBackgroundFields ambiance={ambiance} onChange={onChange} onPickMedia={onPickMedia} />
          <SettingsGroupTitle title="Interface" />
          <AmbianceInterfaceFields ambiance={ambiance} onChange={onChange} />
          <SettingsGroupTitle title="Terminaux" />
          <AmbianceTerminalFields ambiance={ambiance} onChange={onChange} />
          <SettingsGroupTitle title="Effets d’agents" />
          <AmbianceAlertFields ambiance={ambiance} onChange={onChange} />
          <SettingsGroupTitle title="Compagnons" />
          <AmbianceCompanionFields ambiance={ambiance} onChange={onChange} />
          <SettingsGroupTitle title="Avancé" expanded={advancedOpen} onToggle={handleAdvancedToggle} />
          {advancedOpen && <AmbiancePerformanceFields ambiance={ambiance} onChange={onChange} />}
        </>
      )}
    </SettingsPanel>
  )
}
