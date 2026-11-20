import { bridge } from '../bridge/bridge'
import type { StatusLogEntry } from '../bridge/statusLogMessages'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { useStatusLogStore } from '../store/statusLogStore'

const LIST_SELECTOR = '[data-status-log-list]'
const FOCUS_OWNER_SELECTOR = '[data-status-log], [data-status-log-toggle]'
const LEVEL_LABELS: Record<StatusLevel, string> = {
  [StatusLevel.Info]: 'Info',
  [StatusLevel.Warning]: 'Avertissement',
  [StatusLevel.Error]: 'Erreur',
}

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' })
const fullFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'medium' })

export const levelLabel = (level: StatusLevel): string => LEVEL_LABELS[level]

export const entryTime = (entry: StatusLogEntry): string => {
  const at = new Date(entry.at)
  return `${dayFormat.format(at)} ${timeFormat.format(at)}`
}

const copyLine = (entry: StatusLogEntry): string => `${entryTime(entry)}  ${levelLabel(entry.level)}  ${entry.text}`

export const entryFullDate = (entry: StatusLogEntry): string => fullFormat.format(new Date(entry.at))

export const startStatusLog = (): (() => void) =>
  useHostStore.subscribe((state, previous) => {
    const { status } = state
    if (status !== previous.status && status.text.trim().length > 0) {
      bridge.send({ type: 'statusLog.append', message: status.text, level: status.level })
    }
  })

export const receiveStatusLogEntry = (entry: StatusLogEntry): void => useStatusLogStore.getState().add(entry)

export const receiveStatusLogCleared = (): void => {
  useStatusLogStore.getState().clear()
  useHostStore.getState().setStatus('')
}

const focusStatusLog = (): void => document.querySelector<HTMLElement>(LIST_SELECTOR)?.focus()

export const openStatusLog = (): void => {
  useStatusLogStore.getState().setOpen(true)
  requestAnimationFrame(focusStatusLog)
}

export const closeStatusLog = (): void => {
  const leaving = Boolean(document.activeElement?.closest(FOCUS_OWNER_SELECTOR))
  useStatusLogStore.getState().setOpen(false)
  if (leaving) {
    focusActivePane()
  }
}

export const toggleStatusLog = (): void => (useStatusLogStore.getState().open ? closeStatusLog() : openStatusLog())

export const clearStatusLog = (): void => {
  bridge.send({ type: 'statusLog.clear' })
  focusStatusLog()
}

export const copyStatusLog = (): void => {
  const text = useStatusLogStore.getState().entries.map(copyLine).join('\n')
  void navigator.clipboard
    .writeText(text)
    .then(() => useHostStore.getState().setStatus('Journal copié dans le presse-papiers.'))
    .catch(() => useHostStore.getState().setStatus('Copie dans le presse-papiers impossible.', StatusLevel.Error))
}
