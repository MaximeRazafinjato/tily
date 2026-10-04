import { bridge } from '../bridge/bridge'
import type { BrowserState } from '../bridge/browserMessages'
import { BLANK_PAGE, BrowserViewport } from '../model/browser'
import { activePane, activeTab, activeWorkspace, createBrowserPane, findPane, SplitAxis } from '../model/session'
import { useBrowserStore } from '../store/browserStore'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'

export enum BrowserPlacement {
  Beside = 'beside',
  Below = 'below',
  Tab = 'tab',
}

const OPENED_STATUS = 'Navigateur ouvert : saisissez une adresse, par exemple localhost:5173.'
const NO_WORKSPACE_STATUS = 'Ouvrez d’abord un workspace pour y afficher un navigateur.'

export const openBrowser = (placement: BrowserPlacement, url = BLANK_PAGE): string | null => {
  const store = useSessionStore.getState()
  const workspace = store.session ? activeWorkspace(store.session) : undefined
  if (!workspace) {
    useHostStore.getState().setStatus(NO_WORKSPACE_STATUS)
    return null
  }
  const current = activePane(activeTab(workspace))
  const pane = createBrowserPane(current.path, current.shell, url)
  if (placement === BrowserPlacement.Tab) {
    store.newTabWithPane(pane)
  } else {
    store.insertPaneBeside(current.id, placement === BrowserPlacement.Below ? SplitAxis.Vertical : SplitAxis.Horizontal, pane)
  }
  if (url === BLANK_PAGE) {
    useBrowserStore.getState().editUrl(pane.id)
    useHostStore.getState().setStatus(OPENED_STATUS)
  }
  return pane.id
}

export const navigateBrowser = (paneId: string, address: string): void => bridge.send({ type: 'browser.navigate', pane: paneId, url: address })

export const goBack = (paneId: string): void => bridge.send({ type: 'browser.back', pane: paneId })

export const reloadBrowser = (paneId: string): void => bridge.send({ type: 'browser.reload', pane: paneId })

export const openDevTools = (paneId: string): void => bridge.send({ type: 'browser.devtools', pane: paneId })

export const setBrowserViewport = (paneId: string, viewport: BrowserViewport): void => {
  useSessionStore.getState().setPaneViewport(paneId, viewport)
  bridge.send({ type: 'browser.viewport', pane: paneId, viewport })
}

export const receiveBrowserState = (state: BrowserState): void => {
  useBrowserStore.getState().setState(state)
  if (state.url) {
    useSessionStore.getState().setBrowserPage(state.pane, state.url, state.title)
  }
}

export const receiveNewBrowserPane = (paneId: string, url: string): void => {
  const store = useSessionStore.getState()
  const source = store.session ? findPane(store.session, paneId) : undefined
  if (source) {
    store.insertPaneBeside(paneId, SplitAxis.Horizontal, createBrowserPane(source.path, source.shell, url, source.viewport))
  }
}

export const receiveBrowserFocused = (paneId: string): void => {
  const store = useSessionStore.getState()
  const workspace = store.session ? activeWorkspace(store.session) : undefined
  if (!workspace || activeTab(workspace).active !== paneId) {
    store.selectPane(paneId)
  }
}

export const receiveBrowserFailure = (paneId: string, message: string): void => {
  useBrowserStore.getState().setFailure(paneId, message)
  useHostStore.getState().setStatus(message, StatusLevel.Error)
}
