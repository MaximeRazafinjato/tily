import { useEffect, useState, type ChangeEvent } from 'react'
import type { AmbianceSettings, AmbianceTerminal } from '../bridge/appearanceMessages'
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

export function AmbianceTerminalFields({ ambiance, onChange }: AmbianceTerminalFieldsProps) {
  const [fonts, setFonts] = useState(installedTerminalFonts)
  const { terminal } = ambiance
  const updateTerminal = (patch: Partial<AmbianceTerminal>) => onChange({ terminal: { ...terminal, ...patch } })

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

  const families = terminal.fontFamily && !fonts.includes(terminal.fontFamily) ? [terminal.fontFamily, ...fonts] : fonts

  return (
    <>
      <SettingsField label="Habiller">
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={terminal.enabled} onChange={handleEnabledChange} />
          Les terminaux
        </label>
      </SettingsField>
      {terminal.enabled && (
        <>
          <SettingsField label="Voile" tip={VEIL_TIP}>
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
    </>
  )
}
