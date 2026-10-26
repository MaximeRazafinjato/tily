import { bridge } from '../bridge/bridge'
import type { PaneActivity } from '../bridge/messages'
import { allPanes, paneLocation, panesOf, type Session } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { useUiStore, type PaneActivityView } from '../store/uiStore'
import { closeApplication } from './textPersistence'

interface PendingClose {
  title: string
  paneIds: Set<string>
  proceed: () => void
  confirmLabel?: string
  cancelled?: () => void
}

const APPLICATION_TITLE = 'Quitter Tily ?'

let pending: PendingClose | null = null
let confirmed: (() => void) | null = null
let onCancel: (() => void) | null = null

const describePane = (session: Session | null, paneId: string): string => {
  for (const workspace of session?.workspaces ?? []) {
    for (const tab of workspace.tabs) {
      const pane = panesOf(tab.tree).find((candidate) => candidate.id === paneId)
      if (pane) {
        return paneLocation(workspace.name, tab.name, pane.path)
      }
    }
  }
  return paneId
}

const toView = (activity: PaneActivity): PaneActivityView => ({ ...activity, label: describePane(useSessionStore.getState().session, activity.paneId) })

const showCloseConfirmation = (title: string, activity: PaneActivity[], proceed: () => void, confirmLabel?: string, cancelled?: () => void): void => {
  confirmed = proceed
  onCancel = cancelled ?? null
  useUiStore.getState().showCloseConfirmation({ title, panes: activity.map(toView), confirmLabel })
}

export const requestClose = (title: string, paneIds: string[], proceed: () => void, confirmLabel?: string, cancelled?: () => void): void => {
  if (paneIds.length === 0 || !bridge.available) {
    proceed()
    return
  }
  pending = { title, paneIds: new Set(paneIds), proceed, confirmLabel, cancelled }
  bridge.send({ type: 'terminal.activity', panes: paneIds })
}

export const receiveActivity = (panes: PaneActivity[]): void => {
  const current = pending
  if (!current) {
    return
  }
  pending = null
  const relevant = panes.filter((activity) => current.paneIds.has(activity.paneId))
  if (relevant.length === 0) {
    current.proceed()
    return
  }
  showCloseConfirmation(current.title, relevant, current.proceed, current.confirmLabel, current.cancelled)
}

export const requestApplicationClose = (): void => {
  const { session } = useSessionStore.getState()
  requestClose(APPLICATION_TITLE, session ? allPanes(session).map((pane) => pane.id) : [], closeApplication)
}

export const receiveApplicationClosing = (activity: PaneActivity[]): void => {
  if (activity.length === 0) {
    closeApplication()
    return
  }
  bridge.send({ type: 'window.closeCancel' })
  showCloseConfirmation(APPLICATION_TITLE, activity, closeApplication)
}

export const confirmClose = (): void => {
  const proceed = confirmed
  confirmed = null
  onCancel = null
  useUiStore.getState().hideCloseConfirmation()
  proceed?.()
}

export const cancelClose = (): void => {
  const cancelled = onCancel
  confirmed = null
  onCancel = null
  useUiStore.getState().hideCloseConfirmation()
  cancelled?.()
}
