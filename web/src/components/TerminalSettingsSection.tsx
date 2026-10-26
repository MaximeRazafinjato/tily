import type { ChangeEvent } from 'react'
import { DEFAULT_FONT_SIZE, MAX_FONT_SIZE, MIN_FONT_SIZE } from '../model/appearance'
import { NUMBER_FIELDS, numberFieldId, valueWithin, type NumberField } from './persistenceFields'
import { SettingsField } from './SettingsField'
import { SettingsPanel } from './SettingsPanel'
import { SETTINGS_INPUT, SETTINGS_INPUT_BASE } from './settingsStyles'

interface TerminalSettingsSectionProps {
  title: string
  fontSize: number
  numberText: (field: NumberField) => string
  onFontSizeChange: (fontSize: number) => void
  onNumberChange: (field: NumberField, text: string) => void
}

const FONT_SIZES = Array.from({ length: MAX_FONT_SIZE - MIN_FONT_SIZE + 1 }, (_, index) => MIN_FONT_SIZE + index)
const SAMPLE_FONT = '"CaskaydiaCove Nerd Font Mono", "Cascadia Mono", Consolas, monospace'
const FONT_SIZE_ID = 'settings-font-size'
const NUMBER_BOX = 'w-[110px] shrink-0'
const INVALID_INPUT = `${SETTINGS_INPUT_BASE} border-tily-error focus:border-tily-error`

export function TerminalSettingsSection({ title, fontSize, numberText, onFontSizeChange, onNumberChange }: TerminalSettingsSectionProps) {
  const handleFontSizeChange = (event: ChangeEvent<HTMLSelectElement>) => onFontSizeChange(Number(event.target.value))

  return (
    <SettingsPanel title={title}>
      <SettingsField label="Taille du texte" tip="En pixels, pour tous les terminaux." htmlFor={FONT_SIZE_ID}>
        <span className="flex items-center gap-2">
          <span className={NUMBER_BOX}>
            <select id={FONT_SIZE_ID} className={SETTINGS_INPUT} value={fontSize} onChange={handleFontSizeChange}>
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size === DEFAULT_FONT_SIZE ? `${size} (défaut)` : size}
                </option>
              ))}
            </select>
          </span>
          <span className="min-w-0 flex-1 overflow-hidden rounded border border-tily-line bg-tily-terminal px-2 py-1 whitespace-nowrap text-tily-terminal-ink" style={{ fontFamily: SAMPLE_FONT, fontSize }}>
            PS C:\Files\Projects&gt; git status
          </span>
        </span>
      </SettingsField>
      {NUMBER_FIELDS.map((field) => {
        const text = numberText(field)
        const invalid = valueWithin(text, field) === null
        const id = numberFieldId(field.key)
        const bounds = `Entre ${field.min} et ${field.max}.`
        const handleChange = (event: ChangeEvent<HTMLInputElement>) => onNumberChange(field, event.target.value)
        return (
          <SettingsField key={field.key} label={field.label} tip={`${field.hint} ${bounds}`} htmlFor={id}>
            <span className="flex items-center gap-2">
              <span className={NUMBER_BOX}>
                <input id={id} type="number" className={invalid ? INVALID_INPUT : SETTINGS_INPUT} value={text} min={field.min} max={field.max} aria-invalid={invalid} onChange={handleChange} />
              </span>
              {field.unit && <span className="text-[12px] text-tily-muted">{field.unit}</span>}
              {invalid && <span className="text-[11px] text-tily-error">{bounds}</span>}
            </span>
          </SettingsField>
        )
      })}
    </SettingsPanel>
  )
}
