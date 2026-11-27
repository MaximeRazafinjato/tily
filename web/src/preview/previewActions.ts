import { bridge } from '../bridge/bridge'
import type { HostMessageOf } from '../bridge/messages'
import { activeTab, activeWorkspace, folderName, panesOf, RightPanelView, type Session, type Tab, type Workspace } from '../model/session'
import { useHostStore } from '../store/hostStore'
import { usePreviewStore } from '../store/previewStore'
import { useSessionStore } from '../store/sessionStore'
import { guardEdits } from './previewEdit'

const showPreview = (path: string): void => {
  usePreviewStore.getState().open(path)
  bridge.send({ type: 'preview.open', path })
}

export const openPreview = (path: string): void => {
  if (usePreviewStore.getState().path === path) {
    showPreview(path)
  } else {
    guardEdits(() => showPreview(path))
  }
}

export const closePreview = (onClosed?: () => void): void => {
  if (usePreviewStore.getState().path !== null) {
    guardEdits(() => {
      usePreviewStore.getState().close()
      bridge.send({ type: 'preview.close' })
      onClosed?.()
    })
  }
}

const decodeAnchor = (anchor: string): string => {
  try {
    return decodeURIComponent(anchor)
  } catch {
    return anchor
  }
}

export const followPreviewLink = (href: string): void => {
  const { path, jumpTo } = usePreviewStore.getState()
  if (href.startsWith('#')) {
    jumpTo(decodeAnchor(href.slice(1)))
  } else if (path !== null) {
    bridge.send({ type: 'preview.follow', path, href })
  }
}

export const openPreviewInEditor = (): void => {
  const { path } = usePreviewStore.getState()
  if (path !== null) {
    bridge.send({ type: 'files.open', path })
    useHostStore.getState().setStatus(`Ouverture dans l’éditeur : ${folderName(path)}`)
  }
}

export const receivePreview = (message: HostMessageOf<'preview.loaded'>): void =>
  usePreviewStore.getState().receive(message.preview, message.anchor ?? null, message.reload)

export const openPreviewInBrowser = (): void => {
  const { path } = usePreviewStore.getState()
  if (path !== null) {
    bridge.send({ type: 'preview.browser', path })
    useHostStore.getState().setStatus(`Ouverture dans le navigateur : ${folderName(path)}`)
  }
}

const displayedTabId = (session: Session | null): string | null => {
  const workspace = session ? activeWorkspace(session) : undefined
  return workspace ? activeTab(workspace).id : null
}

const locatePane = (session: Session, paneId: string): { workspace: Workspace; tab: Tab } | undefined => {
  for (const workspace of session.workspaces) {
    const tab = workspace.tabs.find((candidate) => panesOf(candidate.tree).some((pane) => pane.id === paneId))
    if (tab) {
      return { workspace, tab }
    }
  }
  return undefined
}

const showInFilesView = (path: string): void => {
  const { session, toggleExplorer, setPanelView } = useSessionStore.getState()
  const workspace = session ? activeWorkspace(session) : undefined
  if (workspace && !activeTab(workspace).explorer) {
    toggleExplorer()
  }
  setPanelView(RightPanelView.Files)
  openPreview(path)
}

export const receivePreviewRequest = (message: HostMessageOf<'preview.requested'>): void => {
  const { session } = useSessionStore.getState()
  const location = session ? locatePane(session, message.pane) : undefined
  if (!location) {
    return
  }
  const name = folderName(message.path)
  if (displayedTabId(session) === location.tab.id) {
    showInFilesView(message.path)
    useHostStore.getState().setStatus(`Aperçu ouvert par Claude Code : ${name}`)
  } else {
    usePreviewStore.getState().defer(location.tab.id, message.path)
    useHostStore.getState().setStatus(`Aperçu prêt dans ${location.workspace.name} › ${location.tab.name} : ${name}`)
  }
}

const switchPreview = (fromTabId: string | null, toTabId: string): void => {
  const wasOpen = usePreviewStore.getState().path !== null
  if (fromTabId !== null) {
    usePreviewStore.getState().park(fromTabId)
  }
  const restored = usePreviewStore.getState().restore(toTabId)
  if (restored !== null) {
    bridge.send({ type: 'preview.open', path: restored })
  } else if (wasOpen) {
    bridge.send({ type: 'preview.close' })
  }
}

const forgetClosedTabs = (session: Session | null): void => {
  const { parked, forget } = usePreviewStore.getState()
  const parkedTabIds = Object.keys(parked)
  if (parkedTabIds.length === 0) {
    return
  }
  const liveTabIds = new Set(session?.workspaces.flatMap((workspace) => workspace.tabs.map((tab) => tab.id)) ?? [])
  const closedTabIds = parkedTabIds.filter((tabId) => !liveTabIds.has(tabId))
  if (closedTabIds.length > 0) {
    forget(closedTabIds)
  }
}

export const startTabPreviews = (): (() => void) =>
  useSessionStore.subscribe((state, previous) => {
    const tabId = displayedTabId(state.session)
    const previousTabId = displayedTabId(previous.session)
    const switched = tabId !== null && tabId !== previousTabId
    if (switched) {
      switchPreview(previousTabId, tabId)
    }
    if (state.session !== previous.session) {
      forgetClosedTabs(state.session)
    }
    if (!switched) {
      return
    }
    const path = usePreviewStore.getState().takeDeferred(tabId)
    if (path !== null) {
      showInFilesView(path)
    }
  })
