import type { ChangeEvent } from 'react'
import { UpdateStatus, type UpdateInfo } from '../bridge/updateMessages'
import { useUpdateStore } from '../store/updateStore'
import { checkForUpdates, downloadPercent, formatTime, showUpdateDialog } from '../update/updateActions'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SettingsField } from './SettingsField'
import { SettingsPanel } from './SettingsPanel'
import { SETTINGS_CHECKBOX, SETTINGS_ICON_BUTTON, SETTINGS_PRIMARY } from './settingsStyles'
import { Spinner } from './Spinner'

interface UpdateSettingsSectionProps {
  title: string
  autoCheck: boolean
  onAutoCheckChange: (autoCheck: boolean) => void
}

const CHECK_NOW = 'Rechercher maintenant'

const checkedSuffix = (info: UpdateInfo): string => (info.checkedAt ? ` · vérifié à ${formatTime(info.checkedAt)}` : '')

const describe = (info: UpdateInfo | null): { text: string; tone: string } => {
  if (!info || info.status === UpdateStatus.Idle) {
    return { text: 'Pas encore vérifié.', tone: 'text-tily-muted' }
  }
  switch (info.status) {
    case UpdateStatus.Checking:
      return { text: 'Vérification auprès de GitHub…', tone: 'text-tily-muted' }
    case UpdateStatus.UpToDate:
      return { text: `Tily ${info.current} est à jour${checkedSuffix(info)}.`, tone: 'text-tily-green' }
    case UpdateStatus.Downloading:
      return { text: `Téléchargement de Tily ${info.release?.version ?? ''} : ${downloadPercent(info)} %`, tone: 'text-tily-ink' }
    case UpdateStatus.Ready:
      return { text: `Tily ${info.release?.version ?? ''} est téléchargé et vérifié, prêt à installer.`, tone: 'text-tily-green' }
    case UpdateStatus.Failed:
      return { text: info.error ?? 'La dernière vérification a échoué.', tone: 'text-tily-error' }
    default:
      return { text: `Tily ${info.release?.version ?? ''} est disponible (version actuelle ${info.current})${checkedSuffix(info)}.`, tone: 'text-tily-green' }
  }
}

export function UpdateSettingsSection({ title, autoCheck, onAutoCheckChange }: UpdateSettingsSectionProps) {
  const info = useUpdateStore((state) => state.info)
  const { text, tone } = describe(info)
  const busy = info?.status === UpdateStatus.Checking || info?.status === UpdateStatus.Downloading
  const handleAutoCheckChange = (event: ChangeEvent<HTMLInputElement>) => onAutoCheckChange(event.target.checked)

  return (
    <SettingsPanel title={title}>
      <SettingsField label="Recherche" tip="Au démarrage puis toutes les 6 heures, auprès des releases publiques du dépôt GitHub. Rien n’est téléchargé ni installé sans votre clic sur « Installer et redémarrer ».">
        <label className={SETTINGS_CHECKBOX}>
          <input type="checkbox" checked={autoCheck} onChange={handleAutoCheckChange} />
          Automatique
        </label>
      </SettingsField>
      <SettingsField label="État">
        <span className="flex items-center gap-2">
          {busy && <Spinner size={11} className="text-tily-green" />}
          <span className={`min-w-0 flex-1 text-[12px] ${tone}`}>{text}</span>
          {info?.release && (
            <button type="button" className={SETTINGS_PRIMARY} onClick={showUpdateDialog}>
              Voir la mise à jour
            </button>
          )}
          <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={CHECK_NOW} aria-disabled={busy} data-tip={CHECK_NOW} onClick={busy ? undefined : checkForUpdates}>
            <Icon name={IconName.Refresh} />
          </button>
        </span>
      </SettingsField>
    </SettingsPanel>
  )
}
