import type { ChangeEvent } from 'react'
import { AmbianceFit, AmbianceGradientType, AmbianceSource, type AmbianceBackground, type AmbianceGradient, type AmbiancePreset, type AmbianceSettings } from '../bridge/appearanceMessages'
import { isCssGradient } from '../ambiance/gradientStyle'
import { AmbianceGradientEditor } from './AmbianceGradientEditor'
import { AmbiancePresetPicker } from './AmbiancePresetPicker'
import { AmbianceSlider } from './AmbianceSlider'
import { ColorInput } from './ColorInput'
import { SettingsField } from './SettingsField'
import { SETTINGS_CHECKBOX, SETTINGS_INPUT, SETTINGS_SECONDARY } from './settingsStyles'

interface AmbianceBackgroundFieldsProps {
  ambiance: AmbianceSettings
  onChange: (patch: Partial<AmbianceSettings>) => void
  onPickMedia: () => void
}

const SOURCE_LABELS: [AmbianceSource, string][] = [
  [AmbianceSource.Gradient, 'Animation'],
  [AmbianceSource.Solid, 'Couleur fixe'],
  [AmbianceSource.Media, 'Image ou vidéo'],
]

const FIT_LABELS: [AmbianceFit, string][] = [
  [AmbianceFit.Cover, 'Remplir la fenêtre'],
  [AmbianceFit.Contain, 'Image entière'],
]
const MEDIA_TIP = 'Le fichier est copié dans le dossier de données de Tily : il reste affiché même si l’original est déplacé.'

const TYPE_LABELS: [AmbianceGradientType, string][] = [
  [AmbianceGradientType.Linear, 'Dégradé linéaire'],
  [AmbianceGradientType.Radial, 'Dégradé radial'],
  [AmbianceGradientType.Plasma, 'Plasma'],
  [AmbianceGradientType.Particles, 'Particules'],
  [AmbianceGradientType.Aurora, 'Aurore boréale'],
  [AmbianceGradientType.Nebula, 'Nébuleuse'],
  [AmbianceGradientType.Sky, 'Ciel réel'],
  [AmbianceGradientType.Caustics, 'Fond marin'],
]

const BANDED_TYPES = new Set([AmbianceGradientType.Linear, AmbianceGradientType.Radial, AmbianceGradientType.Particles])
const TINT_TIP = 'Les décors gardent leurs couleurs naturelles, sauf si cette case les teinte avec les trois premières couleurs.'
const SKY_TIP = 'Le ciel suit l’heure de l’ordinateur : jour, coucher de soleil, nuit étoilée.'

export function AmbianceBackgroundFields({ ambiance, onChange, onPickMedia }: AmbianceBackgroundFieldsProps) {
  const { background, gradient } = ambiance
  const updateBackground = (patch: Partial<AmbianceBackground>) => onChange({ background: { ...background, ...patch } })
  const updateGradient = (patch: Partial<AmbianceGradient>) => onChange({ gradient: { ...gradient, ...patch } })

  const handleBackgroundEnabledChange = (event: ChangeEvent<HTMLInputElement>) => updateBackground({ enabled: event.target.checked })
  const handleSourceChange = (event: ChangeEvent<HTMLSelectElement>) => updateBackground({ source: event.target.value as AmbianceSource })
  const handleSolidColorChange = (solidColor: string) => updateBackground({ solidColor })
  const handleFitChange = (event: ChangeEvent<HTMLSelectElement>) => updateBackground({ fit: event.target.value as AmbianceFit })
  const handleOpacityChange = (opacity: number) => updateBackground({ opacity })
  const handleGradientChange = (next: AmbianceGradient) => onChange({ gradient: next })
  const handlePresetsChange = (presets: AmbiancePreset[]) => onChange({ presets })
  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => updateGradient({ type: event.target.value as AmbianceGradientType })
  const handleColorsChange = (colors: string[]) => updateGradient({ colors })
  const handleAngleChange = (angle: number) => updateGradient({ angle })
  const handleBandChange = (band: number) => updateGradient({ band })
  const handleDurationChange = (duration: number) => updateGradient({ duration })
  const handleReverseChange = (event: ChangeEvent<HTMLInputElement>) => updateGradient({ reverse: event.target.checked })
  const handleTintChange = (event: ChangeEvent<HTMLInputElement>) => onChange({ performance: { ...ambiance.performance, shaderTint: event.target.checked } })

  const shown = background.enabled
  const animated = shown && background.source === AmbianceSource.Gradient
  const shader = !isCssGradient(gradient.type) && gradient.type !== AmbianceGradientType.Particles

  return (
    <>
      <SettingsField label="Afficher">
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={background.enabled} onChange={handleBackgroundEnabledChange} />
          Un fond derrière l’interface
        </label>
      </SettingsField>
      {shown && (
        <SettingsField label="Source">
          <select className={SETTINGS_INPUT} aria-label="Source du fond" value={background.source} onChange={handleSourceChange}>
            {SOURCE_LABELS.map(([source, label]) => (
              <option key={source} value={source}>
                {label}
              </option>
            ))}
          </select>
        </SettingsField>
      )}
      {shown && background.source === AmbianceSource.Solid && (
        <SettingsField label="Couleur">
          <ColorInput value={background.solidColor} label="Couleur du fond" onChange={handleSolidColorChange} />
        </SettingsField>
      )}
      {shown && background.source === AmbianceSource.Media && (
        <SettingsField label="Fichier" tip={MEDIA_TIP}>
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[12px] text-tily-ink">{background.mediaPath ?? 'Aucun fichier choisi'}</span>
            <button type="button" className={SETTINGS_SECONDARY} onClick={onPickMedia}>
              Choisir…
            </button>
          </span>
          <select className={SETTINGS_INPUT} aria-label="Cadrage" value={background.fit} onChange={handleFitChange}>
            {FIT_LABELS.map(([fit, label]) => (
              <option key={fit} value={fit}>
                {label}
              </option>
            ))}
          </select>
        </SettingsField>
      )}
      {animated && (
        <>
          <SettingsField label="Preset">
            <AmbiancePresetPicker ambiance={ambiance} onGradientChange={handleGradientChange} onPresetsChange={handlePresetsChange} />
          </SettingsField>
          <SettingsField label="Animation" tip={gradient.type === AmbianceGradientType.Sky ? SKY_TIP : undefined}>
            <select className={SETTINGS_INPUT} aria-label="Animation" value={gradient.type} onChange={handleTypeChange}>
              {TYPE_LABELS.map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
            {shader && gradient.type !== AmbianceGradientType.Sky && (
              <span className="flex items-center gap-1.5">
                <label className={SETTINGS_CHECKBOX}>
                  <input type="checkbox" checked={ambiance.performance.shaderTint} onChange={handleTintChange} />
                  Teinter avec les couleurs
                </label>
              </span>
            )}
          </SettingsField>
          {(!shader || ambiance.performance.shaderTint) && (
            <SettingsField label="Couleurs" tip={shader ? TINT_TIP : undefined}>
              <AmbianceGradientEditor colors={gradient.colors} onChange={handleColorsChange} />
            </SettingsField>
          )}
          {gradient.type === AmbianceGradientType.Linear && (
            <SettingsField label="Angle">
              <AmbianceSlider label="Angle" value={gradient.angle} min={0} max={360} unit="°" onChange={handleAngleChange} />
            </SettingsField>
          )}
          {BANDED_TYPES.has(gradient.type) && (
            <SettingsField label={gradient.type === AmbianceGradientType.Particles ? 'Liens' : 'Bande'}>
              <AmbianceSlider label="Bande" value={gradient.band} min={200} max={5000} step={50} unit=" px" onChange={handleBandChange} />
            </SettingsField>
          )}
          <SettingsField label="Cycle" tip="Durée d’un tour d’animation ; 0 fige le fond.">
            <AmbianceSlider label="Cycle" value={gradient.duration} min={0} max={60} step={0.5} unit=" s" onChange={handleDurationChange} />
            <label className={SETTINGS_CHECKBOX}>
              <input type="checkbox" checked={gradient.reverse} onChange={handleReverseChange} />
              Sens inverse
            </label>
          </SettingsField>
        </>
      )}
      {shown && (
        <SettingsField label="Intensité">
          <AmbianceSlider label="Intensité" value={background.opacity} min={0} max={100} unit=" %" onChange={handleOpacityChange} />
        </SettingsField>
      )}
    </>
  )
}
