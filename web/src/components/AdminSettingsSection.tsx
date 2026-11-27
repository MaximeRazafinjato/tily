import type { ChangeEvent } from 'react'
import { saveFeatureFlags } from '../featureFlags/featureFlagActions'
import { useFeatureFlagStore } from '../store/featureFlagStore'
import { SettingsField } from './SettingsField'
import { SettingsPanel } from './SettingsPanel'
import { SETTINGS_CHECKBOX, SETTINGS_HINT } from './settingsStyles'

interface AdminSettingsSectionProps {
  title: string
}

const SECTION_TIP = 'Feature flags enregistrés dans feature-flags.json, appliqués aussitôt dans toutes les fenêtres, sans passer par Enregistrer.'
const COSMETICS_TIP = 'Garde-robe au clic droit sur un compagnon et tenues portées. Désactivées, les tenues restent enregistrées et reviennent à la réactivation.'

export function AdminSettingsSection({ title }: AdminSettingsSectionProps) {
  const companionCosmetics = useFeatureFlagStore((state) => state.flags.companionCosmetics)
  const handleCompanionCosmeticsChange = (event: ChangeEvent<HTMLInputElement>) => saveFeatureFlags({ companionCosmetics: event.target.checked })
  return (
    <SettingsPanel title={title} tip={SECTION_TIP}>
      <SettingsField label="Cosmétiques des compagnons" tip={COSMETICS_TIP}>
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={companionCosmetics} onChange={handleCompanionCosmeticsChange} />
          Activer
        </label>
        <span className={SETTINGS_HINT}>Appliqué immédiatement.</span>
      </SettingsField>
    </SettingsPanel>
  )
}
