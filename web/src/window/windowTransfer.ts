import { bridge } from '../bridge/bridge'
import { listenReplies, newAgentRequest } from '../bridge/requestListeners'
import { TransferDropKind, type TransferDrop, type TransferLayout, type TransferredTerminal } from '../bridge/windowMessages'
import { panesOf, tabOfPane, type Session, type Workspace } from '../model/session'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { takePane } from '../store/paneMoves'
import { takeTab, takeWorkspace } from '../store/windowTransfers'
import { isDetachedWindow } from '../store/windowStore'
import { terminalRegistry } from '../terminal/terminalRegistry'

export const MAIN_WINDOW_ID = 'main'

interface TransferContent {
  workspaces: Workspace[]
  remove: (draft: Session) => void
}

interface TransferTarget {
  atCursor: boolean
  window?: string
  drop?: TransferDrop
}

let transferring = false

const layoutOf = (session: Session): TransferLayout => ({
  sidebar: session.sidebar,
  sidebarCollapsed: session.sidebarCollapsed,
  explorerWidth: session.explorerWidth,
  gitGraph: session.gitGraph,
  favorites: session.favorites,
})

const replyOf = <T>(request: number): Promise<T> =>
  new Promise((resolve) => {
    const stop = listenReplies(request, (_type, message) => {
      stop()
      resolve(message as T)
    })
  })

const holdTerminals = (paneIds: string[]): Promise<unknown> => {
  const request = newAgentRequest()
  const held = replyOf(request)
  bridge.send({ type: 'terminal.hold', request, panes: paneIds })
  return held
}

const exportTerminals = async (paneIds: string[]): Promise<TransferredTerminal[]> =>
  (await Promise.all(paneIds.map((paneId) => terminalRegistry.exportTerminal(paneId)))).filter((terminal): terminal is TransferredTerminal => terminal !== undefined)

const transfer = async (content: TransferContent | null, target: TransferTarget): Promise<void> => {
  const { session } = useSessionStore.getState()
  if (!content || !session || transferring) {
    return
  }
  transferring = true
  const paneIds = content.workspaces.flatMap((workspace) => workspace.tabs.flatMap((tab) => panesOf(tab.tree).map((pane) => pane.id)))
  try {
    await holdTerminals(paneIds)
    const terminals = await exportTerminals(paneIds)
    const request = newAgentRequest()
    const reply = replyOf<{ done: boolean }>(request)
    bridge.send({ type: 'window.transfer', request, payload: { workspaces: content.workspaces, terminals, layout: layoutOf(session) }, panes: terminals.filter((terminal) => terminal.started).map((terminal) => terminal.pane), ...target })
    if ((await reply).done) {
      terminalRegistry.release(paneIds)
      useSessionStore.getState().change(content.remove)
    }
  } catch (error) {
    bridge.send({ type: 'terminal.adopted', panes: paneIds })
    useHostStore.getState().setStatus(`Déplacement vers une autre fenêtre impossible : ${error instanceof Error ? error.message : String(error)}`, StatusLevel.Error)
  } finally {
    transferring = false
  }
}

const workspaceContent = (session: Session, workspaceId: string): TransferContent | null => {
  const workspace = session.workspaces.find((candidate) => candidate.id === workspaceId)
  return workspace ? { workspaces: [{ ...workspace, expanded: true }], remove: (draft) => takeWorkspace(draft, workspaceId) } : null
}

const tabContent = (session: Session, tabId: string): TransferContent | null => {
  const workspace = session.workspaces.find((candidate) => candidate.tabs.some((tab) => tab.id === tabId))
  const tab = workspace?.tabs.find((candidate) => candidate.id === tabId)
  if (!workspace || !tab) {
    return null
  }
  if (workspace.tabs.length === 1) {
    return workspaceContent(session, workspace.id)
  }
  const linked = !isDetachedWindow() || workspace.linkedNote === true
  return {
    workspaces: [{ ...workspace, tabs: [tab], active: tab.id, note: linked ? workspace.note : undefined, linkedNote: linked || undefined, expanded: true }],
    remove: (draft) => takeTab(draft, tabId),
  }
}

const paneContent = (session: Session, paneId: string): TransferContent | null => {
  const workspace = session.workspaces.find((candidate) => candidate.tabs.some((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId)))
  const tab = workspace?.tabs.find((candidate) => panesOf(candidate.tree).some((pane) => pane.id === paneId))
  const pane = tab ? panesOf(tab.tree).find((candidate) => candidate.id === paneId) : undefined
  if (!workspace || !tab || !pane) {
    return null
  }
  if (panesOf(tab.tree).length === 1) {
    return tabContent(session, tab.id)
  }
  const linked = !isDetachedWindow() || workspace.linkedNote === true
  const paneTab = tabOfPane(pane)
  return {
    workspaces: [{ ...workspace, tabs: [paneTab], active: paneTab.id, note: linked ? workspace.note : undefined, linkedNote: linked || undefined, expanded: true }],
    remove: (draft) => takePane(draft, paneId),
  }
}

const currentSession = (): Session | null => useSessionStore.getState().session

export const detachPane = (paneId: string, atCursor = false): void => {
  const session = currentSession()
  void transfer(session && paneContent(session, paneId), { atCursor })
}

export const detachTab = (tabId: string, atCursor = false): void => {
  const session = currentSession()
  void transfer(session && tabContent(session, tabId), { atCursor })
}

export const detachWorkspace = (workspaceId: string, atCursor = false): void => {
  const session = currentSession()
  void transfer(session && workspaceContent(session, workspaceId), { atCursor })
}

export const attachTab = (tabId: string, workspaceId?: string): void => {
  const session = currentSession()
  void transfer(session && tabContent(session, tabId), { atCursor: false, window: MAIN_WINDOW_ID, drop: workspaceId ? { kind: TransferDropKind.Tab, workspaceId } : undefined })
}

export const attachWorkspace = (workspaceId: string): void => {
  const session = currentSession()
  void transfer(session && workspaceContent(session, workspaceId), { atCursor: false, window: MAIN_WINDOW_ID })
}

export const isOutsideWindow = (x: number, y: number): boolean => x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight
