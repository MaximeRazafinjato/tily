import type { ChangeEvent } from 'react'
import type { NotificationSettings, SettingsSnapshot } from '../bridge/messages'
import { InfoTip } from './InfoTip'
import { SettingsField } from './SettingsField'
import { SettingsPanel } from './SettingsPanel'
import { SETTINGS_CHECKBOX, SETTINGS_ROW } from './settingsStyles'
import { SoundSetting } from './SoundSetting'

interface NotificationSettingsSectionProps {
  title: string
  notifications: NotificationSettings
  availability: SettingsSnapshot['notifications']
  onChange: (patch: Partial<NotificationSettings>) => void
  onPickSound: () => void
  onPickDoneSound: () => void
  onTestWaiting: () => void
  onTestDone: () => void
}

const CHECKBOX_ROW = `${SETTINGS_ROW} min-h-[30px]`
const SOUND_TIP = 'Un fichier .wav se donne par son chemin absolu ; un chemin invalide revient au son par défaut à l’enregistrement.'

export function NotificationSettingsSection({ title, notifications, availability, onChange, onPickSound, onPickDoneSound, onTestWaiting, onTestDone }: NotificationSettingsSectionProps) {
  const handleToastChange = (event: ChangeEvent<HTMLInputElement>) => onChange({ windowsToast: event.target.checked })
  const handleFlashChange = (event: ChangeEvent<HTMLInputElement>) => onChange({ taskbarFlash: event.target.checked })
  const handleNotifyDoneChange = (event: ChangeEvent<HTMLInputElement>) => onChange({ notifyDone: event.target.checked })
  const handleSoundChange = (sound: string) => onChange({ sound })
  const handleDoneSoundChange = (doneSound: string) => onChange({ doneSound })

  return (
    <SettingsPanel title={title}>
      <SettingsField label="Attente d’un agent" tip="Quand un agent a besoin de vous et que Tily n’est pas la fenêtre active ; les cartes dans Tily restent toujours affichées.">
        <div className="flex flex-col">
          <span className={CHECKBOX_ROW}>
            <label className={SETTINGS_CHECKBOX}>
              <input type="checkbox" checked={notifications.windowsToast} disabled={!availability.toastAvailable} onChange={handleToastChange} />
              Notification Windows
            </label>
            <InfoTip text="Un clic sur la notification rejoint le terminal de l’agent." />
          </span>
          {!availability.toastAvailable && <span className="text-[11px] text-tily-warning">{`Indisponible : le son et le clignotement restent actifs. ${availability.toastError ?? ''}`}</span>}
          <span className={CHECKBOX_ROW}>
            <label className={SETTINGS_CHECKBOX}>
              <input type="checkbox" checked={notifications.taskbarFlash} onChange={handleFlashChange} />
              Clignotement dans la barre des tâches
            </label>
            <InfoTip text="Aussi à la fin d’une commande de plus de 10 s." />
          </span>
        </div>
      </SettingsField>
      <SettingsField label="Son d’attente" tip={SOUND_TIP}>
        <SoundSetting label="Son d’attente" sound={notifications.sound} placeholder="C:\Sons\attention.wav" testTip="Tester la notification" onChange={handleSoundChange} onPick={onPickSound} onTest={onTestWaiting} />
      </SettingsField>
      <SettingsField label="Fin d’un agent" tip="Chaque fois qu’un agent termine, même si Tily est la fenêtre active.">
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={notifications.notifyDone} onChange={handleNotifyDoneChange} />
          Notifier
        </label>
      </SettingsField>
      {notifications.notifyDone && (
        <SettingsField label="Son de fin" tip={SOUND_TIP}>
          <SoundSetting label="Son de fin" sound={notifications.doneSound} placeholder="C:\Sons\termine.wav" testTip="Tester la notification de fin" onChange={handleDoneSoundChange} onPick={onPickDoneSound} onTest={onTestDone} />
        </SettingsField>
      )}
    </SettingsPanel>
  )
}
