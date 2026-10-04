import { isBrowserPane, panesOf, type Pane, type Session, type Tab, type Workspace } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { terminalRegistry, type TerminalHandle } from '../terminal/terminalRegistry'

export interface PanePlace {
  workspace: Workspace
  tab: Tab
  pane: Pane
}

export interface McpPaneTarget extends PanePlace {
  handle: TerminalHandle
}

interface TabPlace {
  workspace: Workspace
  tab: Tab
}

export const requireSession = (): Session => {
  const { session } = useSessionStore.getState()
  if (!session) {
    throw new Error('La session de Tily n’est pas encore chargée.')
  }
  return session
}

export const placesOf = (session: Session): PanePlace[] =>
  session.workspaces.flatMap((workspace) => workspace.tabs.flatMap((tab) => panesOf(tab.tree).map((pane) => ({ workspace, tab, pane }))))

export const locationOf = (target: { workspace: Workspace; tab: Tab }): string => `${target.workspace.name} › ${target.tab.name}`

export const placeOf = (session: Session, paneId: string | undefined): PanePlace | undefined =>
  paneId ? placesOf(session).find((candidate) => candidate.pane.id === paneId) : undefined

export const startedPanes = (session: Session): McpPaneTarget[] =>
  placesOf(session).flatMap((place) => {
    const handle = terminalRegistry.get(place.pane.id)
    return handle?.started ? [{ ...place, handle }] : []
  })

export const requirePlace = (paneId: string | undefined): PanePlace => {
  if (!paneId) {
    throw new Error('Indiquez le pane visé : son identifiant est donné par tily_layout.')
  }
  const place = placeOf(requireSession(), paneId)
  if (!place) {
    throw new Error(`Pane inconnu : ${paneId}. Les identifiants des panes sont donnés par tily_layout.`)
  }
  return place
}

export const requireStartedPane = (paneId: string | undefined): McpPaneTarget => {
  const place = requirePlace(paneId)
  if (isBrowserPane(place.pane)) {
    throw new Error(`Le pane ${place.pane.id} (${locationOf(place)}) est un navigateur, pas un terminal : lisez sa console et son réseau avec tily_browser_console et tily_browser_network.`)
  }
  const handle = terminalRegistry.get(place.pane.id)
  if (!handle?.started) {
    throw new Error(`Le pane ${place.pane.id} (${locationOf(place)}) n’a pas démarré : il n’a jamais été affiché depuis le lancement de Tily, son shell ne tourne pas. Affichez-le avec tily_focus.`)
  }
  return { ...place, handle }
}

export const requireWorkspace = (workspaceId: string): Workspace => {
  const workspace = requireSession().workspaces.find((candidate) => candidate.id === workspaceId)
  if (!workspace) {
    throw new Error(`Workspace inconnu : ${workspaceId}. Les identifiants des workspaces sont donnés par tily_layout.`)
  }
  return workspace
}

export const requireTab = (tabId: string): TabPlace => {
  for (const workspace of requireSession().workspaces) {
    const tab = workspace.tabs.find((candidate) => candidate.id === tabId)
    if (tab) {
      return { workspace, tab }
    }
  }
  throw new Error(`Onglet inconnu : ${tabId}. Les identifiants des onglets sont donnés par tily_layout.`)
}
