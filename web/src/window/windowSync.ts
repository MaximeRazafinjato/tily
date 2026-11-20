import { bridge } from '../bridge/bridge'
import { RightPanelView, type Session } from '../model/session'
import { openPanelView } from '../panel/rightPanel'
import { useSessionStore } from '../store/sessionStore'
import { isDetachedWindow, useWindowStore } from '../store/windowStore'
import { syncLinkedNotes } from '../store/windowTransfers'

const LABEL_SEPARATOR = ' › '

const tabLabels = (session: Session): string[] => session.workspaces.flatMap((workspace) => workspace.tabs.map((tab) => `${workspace.name}${LABEL_SEPARATOR}${tab.name}`))

const mainWorkspacesOf = (session: Session) => session.workspaces.map(({ id, name, note }) => ({ id, name, note }))

export const showWorkspaceNote = (workspaceId: string): void => {
  useSessionStore.getState().selectWorkspace(workspaceId)
  openPanelView(RightPanelView.Notes)
}

export const startLinkedNoteSync = (): (() => void) =>
  useWindowStore.subscribe((state, previous) => {
    if (state.mainWorkspaces !== previous.mainWorkspaces && isDetachedWindow()) {
      useSessionStore.getState().change((draft) => syncLinkedNotes(draft, state.mainWorkspaces))
    }
  })

export const startWindowSync = (): (() => void) => {
  let sent = ''
  const sendOnce = (key: string, send: () => void): void => {
    if (key !== sent) {
      sent = key
      send()
    }
  }
  return useSessionStore.subscribe((state, previous) => {
    const { session } = state
    if (!session || session === previous.session) {
      return
    }
    if (!isDetachedWindow()) {
      const workspaces = mainWorkspacesOf(session)
      sendOnce(JSON.stringify(workspaces), () => bridge.send({ type: 'window.workspaces', workspaces }))
      return
    }
    if (session.workspaces.length === 0 && (previous.session?.workspaces.length ?? 0) > 0) {
      bridge.send({ type: 'window.close' })
      return
    }
    const tabs = tabLabels(session)
    sendOnce(JSON.stringify(tabs), () => bridge.send({ type: 'window.summary', tabs }))
  })
}
