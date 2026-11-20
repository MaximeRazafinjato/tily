import type { ChangeEvent } from 'react'
import { AmbianceAlertEffect, type AmbianceAlert, type AmbianceSettings } from '../bridge/appearanceMessages'
import { AttentionKind } from '../bridge/messages'
import { playAlert } from '../ambiance/alerts/agentAlerts'
import { ColorInput } from './ColorInput'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SettingsField } from './SettingsField'
import { SETTINGS_CHECKBOX, SETTINGS_ICON_BUTTON, SETTINGS_INPUT } from './settingsStyles'

interface AmbianceAlertFieldsProps {
  ambiance: AmbianceSettings
  onChange: (patch: Partial<AmbianceSettings>) => void
}

const EFFECT_LABELS: [AmbianceAlertEffect, string][] = [
  [AmbianceAlertEffect.Pulse, 'Bordure'],
  [AmbianceAlertEffect.Wave, 'Onde'],
  [AmbianceAlertEffect.Confetti, 'Confettis'],
  [AmbianceAlertEffect.Flash, 'Stroboscope'],
  [AmbianceAlertEffect.Shake, 'Secousse'],
  [AmbianceAlertEffect.Glitch, 'Glitch'],
  [AmbianceAlertEffect.Fireworks, 'Feux d’artifice'],
  [AmbianceAlertEffect.Laser, 'Laser'],
  [AmbianceAlertEffect.Orbit, 'Comètes'],
  [AmbianceAlertEffect.Rays, 'Rayons'],
  [AmbianceAlertEffect.Matrix, 'Pluie de code'],
  [AmbianceAlertEffect.Warp, 'Hyperespace'],
  [AmbianceAlertEffect.Banner, 'Bannière'],
]

const ALERTS: { kind: AttentionKind; field: 'done' | 'waiting'; label: string; tip: string }[] = [
  { kind: AttentionKind.Done, field: 'done', label: 'Fin d’un agent', tip: 'Effet plein écran quand un agent termine, sauf s’il a été interrompu.' },
  { kind: AttentionKind.Waiting, field: 'waiting', label: 'Attente d’un agent', tip: 'Effet plein écran quand un agent attend une réponse ou une autorisation.' },
]

export function AmbianceAlertFields({ ambiance, onChange }: AmbianceAlertFieldsProps) {
  return (
    <>
      {ALERTS.map(({ kind, field, label, tip }) => {
        const alert = ambiance[field]
        const update = (patch: Partial<AmbianceAlert>) => onChange({ [field]: { ...alert, ...patch } })
        const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => update({ enabled: event.target.checked })
        const handleEffectChange = (event: ChangeEvent<HTMLSelectElement>) => update({ effect: event.target.value as AmbianceAlertEffect })
        const handleColorChange = (color: string) => update({ color })
        const handleTest = () => playAlert(alert, kind)
        const test = `Tester l’effet « ${label} »`
        return (
          <SettingsField key={field} label={label} tip={tip}>
            <label className={SETTINGS_CHECKBOX}>
              <input type="checkbox" checked={alert.enabled} onChange={handleEnabledChange} />
              Effet visuel
            </label>
            {alert.enabled && (
              <span className="flex items-center gap-1.5">
                <select className={SETTINGS_INPUT} aria-label={`Effet : ${label}`} value={alert.effect} onChange={handleEffectChange}>
                  {EFFECT_LABELS.map(([effect, effectLabel]) => (
                    <option key={effect} value={effect}>
                      {effectLabel}
                    </option>
                  ))}
                </select>
                <ColorInput value={alert.color} label={`Couleur : ${label}`} onChange={handleColorChange} />
                <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={test} data-tip={test} onClick={handleTest}>
                  <Icon name={IconName.Play} />
                </button>
              </span>
            )}
          </SettingsField>
        )
      })}
    </>
  )
}
