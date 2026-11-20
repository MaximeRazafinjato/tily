import { bridge } from '../bridge/bridge'
import type { HostMessageOf } from '../bridge/messages'
import { TransferDropKind, type TransferDrop, type TransferPayload } from '../bridge/windowMessages'
import { activePane, panesOf, type Pane } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { insertTransfer } from '../store/windowTransfers'
import { isDetachedWindow } from '../store/windowStore'
import { joinPane } from '../terminal/terminalActions'
import { terminalRegistry } from '../terminal/terminalRegistry'
import { transferDropAt } from './windowDrag'

type ReceivedTransfer = HostMessageOf<'window.receive'>

let pending: ReceivedTransfer[] = []

const movedTabIds = (payload: TransferPayload): string[] => payload.workspaces.flatMap((workspace) => workspace.tabs.map((tab) => tab.id))

const movedPanes = (payload: TransferPayload): Pane[] => payload.workspaces.flatMap((workspace) => workspace.tabs.flatMap((tab) => panesOf(tab.tree)))

const dropAt = (payload: TransferPayload, x: number, y: number): TransferDrop | null => {
  const tabIds = movedTabIds(payload)
  return transferDropAt(tabIds.length === 1, x, y, tabIds[0])
}

const applyDrop = (payload: TransferPayload, drop: TransferDrop): void => {
  const store = useSessionStore.getState()
  const tabIds = movedTabIds(payload)
  const singleTab = tabIds.length === 1 ? tabIds[0] : undefined
  if (drop.kind === TransferDropKind.Tab && singleTab && drop.workspaceId) {
    store.moveTab(singleTab, drop.workspaceId, drop.beforeTabId)
  } else if (drop.kind === TransferDropKind.Pane && singleTab && drop.paneId && drop.edge) {
    store.moveTabIntoPane(singleTab, drop.paneId, drop.edge)
  } else if (drop.kind === TransferDropKind.Workspace && payload.workspaces.length === 1) {
    store.moveWorkspaceBefore(payload.workspaces[0].id, drop.beforeWorkspaceId)
  }
}

const joinMovedTab = (payload: TransferPayload): void => {
  const [tabId] = movedTabIds(payload)
  const tab = useSessionStore.getState().session?.workspaces.flatMap((workspace) => workspace.tabs).find((candidate) => candidate.id === tabId)
  if (tab) {
    requestAnimationFrame(() => joinPane(activePane(tab).id))
  }
}

const apply = ({ payload, x, y, drop }: ReceivedTransfer): void => {
  const panes = new Map(movedPanes(payload).map((pane) => [pane.id, pane]))
  for (const terminal of payload.terminals) {
    const pane = panes.get(terminal.pane)
    if (pane) {
      terminalRegistry.adopt(pane, terminal)
    }
  }
  const target = drop ?? (typeof x === 'number' && typeof y === 'number' ? dropAt(payload, x, y) : null)
  useSessionStore.getState().change((draft) => insertTransfer(draft, payload, isDetachedWindow()))
  if (target) {
    applyDrop(payload, target)
  }
  bridge.send({ type: 'terminal.adopted', panes: payload.terminals.filter((terminal) => terminal.started).map((terminal) => terminal.pane) })
  joinMovedTab(payload)
}

export const receiveTransfer = (message: ReceivedTransfer): void => {
  if (useSessionStore.getState().session) {
    apply(message)
  } else {
    pending.push(message)
  }
}

export const applyPendingTransfers = (): void => {
  const queued = pending
  pending = []
  queued.forEach(apply)
}
