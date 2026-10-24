import { useEffect } from 'react'
import { activeTab, activeWorkspace, panesOf, type Tab } from '../model/session'
import { useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { useUiStore } from '../store/uiStore'
import { Command } from '../keyboard/commands'
import { shortcutText } from '../keyboard/shortcutLabels'

const SINGLE_PANE_STATUS = 'Un seul pane dans cet onglet : rien à agrandir.'
const zoomedStatus = (): string => {
  const shortcut = shortcutText(Command.TogglePaneZoom)
  return `Pane agrandi, les autres tournent toujours : ${shortcut ? `${shortcut} ou ` : ''}« Réduire » dans son en-tête pour les revoir.`
}
const UNZOOMED_STATUS = 'Tous les panes de l’onglet sont de nouveau affichés.'
const MIN_PANES_TO_ZOOM = 2

const currentTab = (): Tab | undefined => {
  const { session } = useSessionStore.getState()
  const workspace = session ? activeWorkspace(session) : undefined
  return workspace ? activeTab(workspace) : undefined
}

export const zoomedPaneOf = (tab: Tab, zoomedPaneId: string | null) =>
  zoomedPaneId === tab.active && panesOf(tab.tree).length >= MIN_PANES_TO_ZOOM ? panesOf(tab.tree).find((pane) => pane.id === zoomedPaneId) : undefined

const NO_STATUS = ''

export const endPaneZoom = (sameTab: boolean): void => {
  useUiStore.getState().clearPaneZoom()
  const { status, setStatus } = useHostStore.getState()
  if (status.text === zoomedStatus()) {
    setStatus(sameTab ? UNZOOMED_STATUS : NO_STATUS)
  }
}

export const useEndZoomWhenPaneChanges = (zoomedPaneId: string | null, tab: Tab | undefined): void => {
  const activePaneId = tab?.active
  const zoomedInTab = Boolean(tab && zoomedPaneId && panesOf(tab.tree).some((pane) => pane.id === zoomedPaneId))
  useEffect(() => {
    if (zoomedPaneId !== null && zoomedPaneId !== activePaneId) {
      endPaneZoom(zoomedInTab)
    }
  }, [zoomedPaneId, activePaneId, zoomedInTab])
}

export const togglePaneZoom = (paneId?: string): void => {
  const tab = currentTab()
  if (!tab) {
    return
  }
  if (panesOf(tab.tree).length < MIN_PANES_TO_ZOOM) {
    useHostStore.getState().setStatus(SINGLE_PANE_STATUS)
    return
  }
  const target = paneId ?? tab.active
  useSessionStore.getState().selectPane(target)
  useUiStore.getState().togglePaneZoom(target)
  useHostStore.getState().setStatus(useUiStore.getState().zoomedPaneId === target ? zoomedStatus() : UNZOOMED_STATUS)
}
