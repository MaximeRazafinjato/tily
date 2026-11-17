import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { AmbianceGradient, AmbiancePreset, AmbianceSettings } from '../bridge/appearanceMessages'
import { allAmbiancePresets, cyclePreset, isBuiltInPreset, matchingPreset, withoutPreset, withSavedPreset } from '../ambiance/ambianceActions'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SETTINGS_ICON_BUTTON, SETTINGS_INPUT } from './settingsStyles'

interface AmbiancePresetPickerProps {
  ambiance: AmbianceSettings
  onGradientChange: (gradient: AmbianceGradient) => void
  onPresetsChange: (presets: AmbiancePreset[]) => void
}

const CUSTOM = ''
const PREVIOUS = 'Preset précédent'
const NEXT = 'Preset suivant'
const SAVE = 'Enregistrer comme preset'
const MAX_NAME_LENGTH = 40

export function AmbiancePresetPicker({ ambiance, onGradientChange, onPresetsChange }: AmbiancePresetPickerProps) {
  const [name, setName] = useState('')
  const presets = allAmbiancePresets(ambiance)
  const current = matchingPreset(ambiance)
  const trimmed = name.trim()
  const nameError = trimmed.length > 0 && isBuiltInPreset(trimmed) ? 'Ce nom est celui d’un preset intégré.' : null
  const userPreset = current && ambiance.presets.some((preset) => preset.name === current.name) ? current : undefined
  const remove = userPreset ? `Supprimer le preset ${userPreset.name}` : ''

  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const preset = presets.find((candidate) => candidate.name === event.target.value)
    if (preset) {
      onGradientChange(preset.gradient)
    }
  }
  const handlePrevious = () => onGradientChange(cyclePreset(ambiance, -1))
  const handleNext = () => onGradientChange(cyclePreset(ambiance, 1))
  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)
  const handleSave = () => {
    if (trimmed.length > 0 && !nameError) {
      onPresetsChange(withSavedPreset(ambiance, trimmed))
      setName('')
    }
  }
  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSave()
    }
  }
  const handleRemove = () => {
    if (userPreset) {
      onPresetsChange(withoutPreset(ambiance, userPreset.name))
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5">
        <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={PREVIOUS} data-tip={PREVIOUS} onClick={handlePrevious}>
          <Icon name={IconName.Chevron} size={10} className="rotate-180" />
        </button>
        <select className={SETTINGS_INPUT} aria-label="Preset" value={current?.name ?? CUSTOM} onChange={handleSelect}>
          {!current && <option value={CUSTOM}>Personnalisé</option>}
          {presets.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
        <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={NEXT} data-tip={NEXT} onClick={handleNext}>
          <Icon name={IconName.Chevron} size={10} />
        </button>
        {userPreset && (
          <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={remove} data-tip={remove} onClick={handleRemove}>
            <Icon name={IconName.Close} />
          </button>
        )}
      </span>
      <span className="flex items-center gap-1.5">
        <input type="text" className={SETTINGS_INPUT} placeholder="Nom du nouveau preset" aria-label="Nom du nouveau preset" maxLength={MAX_NAME_LENGTH} value={name} onChange={handleNameChange} onKeyDown={handleNameKeyDown} />
        <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={SAVE} aria-disabled={trimmed.length === 0 || nameError !== null} data-tip={`${SAVE} (Entrée)`} onClick={handleSave}>
          <Icon name={IconName.Check} />
        </button>
      </span>
      {nameError && <span className="text-[11px] text-tily-warning">{nameError}</span>}
    </div>
  )
}
