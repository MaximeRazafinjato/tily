import type { ChangeEvent } from 'react'
import { NotificationSound } from '../bridge/messages'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SETTINGS_BROWSE, SETTINGS_INPUT } from './settingsStyles'

interface SoundSettingProps {
  label: string
  sound: string
  placeholder: string
  testTip: string
  onChange: (sound: string) => void
  onPick: () => void
  onTest: () => void
}

const CUSTOM_SOUND = 'custom'
const PICK_TIP = 'Choisir un fichier .wav'

const SOUND_LABELS: Record<NotificationSound, string> = {
  [NotificationSound.None]: 'Aucun',
  [NotificationSound.Default]: 'Notification par défaut',
  [NotificationSound.InstantMessage]: 'Message instantané',
  [NotificationSound.Mail]: 'Courrier',
  [NotificationSound.Reminder]: 'Rappel',
  [NotificationSound.Sms]: 'SMS',
}

const isCustomSound = (sound: string): boolean => !Object.values<string>(NotificationSound).includes(sound)

export function SoundSetting({ label, sound, placeholder, testTip, onChange, onPick, onTest }: SoundSettingProps) {
  const custom = isCustomSound(sound)
  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value === CUSTOM_SOUND ? '' : event.target.value)
  const handlePathChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)

  return (
    <>
      <span className="flex gap-1">
        <select className={SETTINGS_INPUT} value={custom ? CUSTOM_SOUND : sound} aria-label={label} onChange={handleSelect}>
          {Object.values(NotificationSound).map((known) => (
            <option key={known} value={known}>
              {SOUND_LABELS[known]}
            </option>
          ))}
          <option value={CUSTOM_SOUND}>Fichier .wav de mon ordinateur…</option>
        </select>
        <button type="button" className={SETTINGS_BROWSE} aria-label={testTip} data-tip={testTip} onClick={onTest}>
          <Icon name={IconName.Play} />
        </button>
      </span>
      {custom && (
        <span className="flex gap-1">
          <input type="text" className={SETTINGS_INPUT} value={sound} placeholder={placeholder} spellCheck={false} aria-label={`${label} : fichier .wav`} onChange={handlePathChange} />
          <button type="button" className={SETTINGS_BROWSE} aria-label={PICK_TIP} data-tip={PICK_TIP} onClick={onPick}>
            <Icon name={IconName.More} />
          </button>
        </span>
      )}
    </>
  )
}
