import type { ChangeEvent } from 'react'
import type { AmbiancePerformance, AmbianceSettings } from '../bridge/appearanceMessages'
import { AmbianceSlider } from './AmbianceSlider'
import { SettingsField } from './SettingsField'
import { SETTINGS_CHECKBOX } from './settingsStyles'

interface AmbiancePerformanceFieldsProps {
  ambiance: AmbianceSettings
  onChange: (patch: Partial<AmbianceSettings>) => void
}

const QUALITY_TIP = 'Résolution des décors animés ; une valeur basse soulage la carte graphique.'

export function AmbiancePerformanceFields({ ambiance, onChange }: AmbiancePerformanceFieldsProps) {
  const { performance } = ambiance
  const updatePerformance = (patch: Partial<AmbiancePerformance>) => onChange({ performance: { ...performance, ...patch } })

  const handleQualityChange = (shaderQuality: number) => updatePerformance({ shaderQuality })
  const handleFpsChange = (fpsLimit: number) => updatePerformance({ fpsLimit })
  const handlePauseChange = (event: ChangeEvent<HTMLInputElement>) => updatePerformance({ pauseInactive: event.target.checked })

  return (
    <>
      <SettingsField label="Qualité" tip={QUALITY_TIP}>
        <AmbianceSlider label="Qualité" value={performance.shaderQuality} min={25} max={100} step={5} unit=" %" onChange={handleQualityChange} />
      </SettingsField>
      <SettingsField label="Images par seconde">
        <AmbianceSlider label="Images par seconde" value={performance.fpsLimit} min={10} max={60} step={5} unit="" onChange={handleFpsChange} />
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={performance.pauseInactive} onChange={handlePauseChange} />
          Pause quand Tily n’est pas la fenêtre active
        </label>
      </SettingsField>
    </>
  )
}
