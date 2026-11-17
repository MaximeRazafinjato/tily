import { useEffect, useState, type ChangeEvent } from 'react'
import type { AmbiancePerformance, AmbianceSettings, AmbianceTerminal } from '../bridge/appearanceMessages'
import { installedTerminalFonts, localTerminalFonts } from '../ambiance/terminalFonts'
import { AmbianceSlider } from './AmbianceSlider'
import { SettingsField } from './SettingsField'
import { SETTINGS_CHECKBOX, SETTINGS_INPUT } from './settingsStyles'

interface AmbianceTerminalFieldsProps {
  ambiance: AmbianceSettings
  onChange: (patch: Partial<AmbianceSettings>) => void
}

const DEFAULT_FONT = ''
const VEIL_TIP = 'Opacité du fond des terminaux : en dessous de 100 %, le fond de l’ambiance apparaît derrière le texte.'
const PERFORMANCE_TIP = 'Qualité : résolution des décors animés ; une valeur basse soulage la carte graphique.'

export function AmbianceTerminalFields({ ambiance, onChange }: AmbianceTerminalFieldsProps) {
  const [fonts, setFonts] = useState(installedTerminalFonts)
  const { terminal, performance } = ambiance
  const updateTerminal = (patch: Partial<AmbianceTerminal>) => onChange({ terminal: { ...terminal, ...patch } })
  const updatePerformance = (patch: Partial<AmbiancePerformance>) => onChange({ performance: { ...performance, ...patch } })

  useEffect(() => {
    let active = true
    void localTerminalFonts(installedTerminalFonts()).then((families) => {
      if (active) {
        setFonts(families)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => updateTerminal({ enabled: event.target.checked })
  const handleVeilChange = (veil: number) => updateTerminal({ veil })
  const handlePresetColorsChange = (event: ChangeEvent<HTMLInputElement>) => updateTerminal({ presetColors: event.target.checked })
  const handleFontChange = (event: ChangeEvent<HTMLSelectElement>) => updateTerminal({ fontFamily: event.target.value || undefined })
  const handleAccentChange = (event: ChangeEvent<HTMLInputElement>) => onChange({ animatedAccent: event.target.checked })
  const handleQualityChange = (shaderQuality: number) => updatePerformance({ shaderQuality })
  const handleFpsChange = (fpsLimit: number) => updatePerformance({ fpsLimit })
  const handlePauseChange = (event: ChangeEvent<HTMLInputElement>) => updatePerformance({ pauseInactive: event.target.checked })

  const families = terminal.fontFamily && !fonts.includes(terminal.fontFamily) ? [terminal.fontFamily, ...fonts] : fonts

  return (
    <>
      <SettingsField label="Terminaux">
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={terminal.enabled} onChange={handleEnabledChange} />
          Habiller les terminaux
        </label>
      </SettingsField>
      {terminal.enabled && (
        <>
          <SettingsField label="Voile des terminaux" tip={VEIL_TIP}>
            <AmbianceSlider label="Voile des terminaux" value={terminal.veil} min={0} max={100} unit=" %" onChange={handleVeilChange} />
          </SettingsField>
          <SettingsField label="Curseur et sélection">
            <label className={SETTINGS_CHECKBOX}>
              <input type="checkbox" checked={terminal.presetColors} onChange={handlePresetColorsChange} />
              Aux couleurs de l’ambiance
            </label>
          </SettingsField>
          <SettingsField label="Police">
            <select className={SETTINGS_INPUT} aria-label="Police des terminaux" value={terminal.fontFamily ?? DEFAULT_FONT} onChange={handleFontChange}>
              <option value={DEFAULT_FONT}>Police de Tily</option>
              {families.map((family) => (
                <option key={family} value={family} style={{ fontFamily: `"${family}"` }}>
                  {family}
                </option>
              ))}
            </select>
          </SettingsField>
        </>
      )}
      <SettingsField label="Accent">
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={ambiance.animatedAccent} onChange={handleAccentChange} />
          Animer la couleur de Tily avec l’ambiance
        </label>
      </SettingsField>
      <SettingsField label="Qualité" tip={PERFORMANCE_TIP}>
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
