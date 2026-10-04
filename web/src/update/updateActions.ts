import { bridge } from '../bridge/bridge'
import { UpdateStatus, type UpdateInfo } from '../bridge/updateMessages'
import { activePane, activeTab, activeWorkspace, allPanes } from '../model/session'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { useUiStore } from '../store/uiStore'
import { useUpdateStore } from '../store/updateStore'
import { requestClose } from '../terminal/closeGuard'
import { focusPane } from '../terminal/terminalActions'
import { closeApplication } from '../terminal/textPersistence'

const MEBIBYTE = 1024 * 1024

let manualCheck = false
let installRequested = false

const sizeFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export const formatMebibytes = (bytes: number): string => `${sizeFormat.format(bytes / MEBIBYTE)} Mo`

export const formatDate = (iso: string): string => dateFormat.format(new Date(iso))

export const formatTime = (iso: string): string => timeFormat.format(new Date(iso))

export const downloadPercent = (info: UpdateInfo): number => (info.total > 0 ? Math.min(100, Math.floor((info.received / info.total) * 100)) : 0)

export const checkForUpdates = (): void => {
  manualCheck = true
  bridge.send({ type: 'update.check' })
}

const restartToInstall = (version: string): void => {
  installRequested = false
  const { session } = useSessionStore.getState()
  const paneIds = session ? allPanes(session).map((pane) => pane.id) : []
  requestClose(`Installer Tily ${version} et redémarrer ?`, paneIds, () => bridge.send({ type: 'update.apply' }), 'Arrêter et installer')
}

export const installUpdate = (): void => {
  const { info } = useUpdateStore.getState()
  if (!info?.release) {
    return
  }
  if (info.status === UpdateStatus.Ready) {
    restartToInstall(info.release.version)
    return
  }
  installRequested = true
  bridge.send({ type: 'update.install' })
}

export const receiveUpdateRestart = (): void => closeApplication()

export const receiveRestartRequest = (id: string, version: string): void => {
  const { session } = useSessionStore.getState()
  const paneIds = session ? allPanes(session).map((pane) => pane.id) : []
  const answer = (confirmed: boolean) => () => bridge.send({ type: 'update.restartAnswer', id, confirmed })
  requestClose(`Installer Tily ${version} et redémarrer ? Une autre fenêtre de Tily le demande.`, paneIds, answer(true), 'Arrêter et installer', answer(false))
}

export const receiveUpdateNotice = (message: string, warning: boolean): void =>
  useHostStore.getState().setStatus(message, warning ? StatusLevel.Warning : StatusLevel.Info)

export const cancelUpdateDownload = (): void => {
  installRequested = false
  bridge.send({ type: 'update.cancel' })
}

export const openReleasePage = (info: UpdateInfo): void => bridge.send({ type: 'link.open', url: info.release?.url ?? info.releasesPage })

export const showUpdateDialog = (): void => {
  useUiStore.getState().closeSettings()
  useUpdateStore.getState().openDialog()
}

export const closeUpdateDialog = (): void => {
  useUpdateStore.getState().closeDialog()
  const { session } = useSessionStore.getState()
  const workspace = session ? activeWorkspace(session) : undefined
  if (workspace) {
    focusPane(activePane(activeTab(workspace)).id)
  }
}

const reportManualCheck = (info: UpdateInfo): void => {
  const { setStatus } = useHostStore.getState()
  if (info.status === UpdateStatus.UpToDate) {
    setStatus(`Tily ${info.current} est à jour.`)
  } else if (info.status === UpdateStatus.Available && info.release) {
    setStatus(`Tily ${info.release.version} est disponible : bouton « Mise à jour » dans l’en-tête.`)
  } else if (info.status === UpdateStatus.Failed && info.error) {
    setStatus(info.error, StatusLevel.Error)
  }
}

export const receiveUpdateState = (info: UpdateInfo): void => {
  useUpdateStore.getState().setInfo(info)
  if (manualCheck && info.status !== UpdateStatus.Checking) {
    manualCheck = false
    reportManualCheck(info)
  }
  if (!installRequested || info.status === UpdateStatus.Downloading) {
    return
  }
  if (info.status === UpdateStatus.Ready && info.release) {
    restartToInstall(info.release.version)
  } else if (info.status !== UpdateStatus.Checking) {
    installRequested = false
    if (info.status === UpdateStatus.Failed && info.error) {
      useHostStore.getState().setStatus(info.error, StatusLevel.Error)
    }
  }
}
