import type { BrowserState } from '../bridge/browserMessages'
import type { PaneAgent } from '../bridge/messages'
import { BrowserViewport } from '../model/browser'
import { isBrowserPane, panesOf, type Pane, type Session } from '../model/session'

interface McpPaneAgent {
  name: string
  state: string
  message?: string
}

interface McpOwnership {
  owner?: string
  mine?: true
}

interface McpBrowserLayout {
  kind?: 'browser'
  url?: string
  title?: string
  viewport?: BrowserViewport
  errors?: number
}

interface McpPaneLayout extends McpOwnership, McpBrowserLayout {
  id: string
  path: string
  shell: string
  active: boolean
  started: boolean
  caller?: true
  agent?: McpPaneAgent
}

interface McpTabLayout extends McpOwnership {
  id: string
  name: string
  active: boolean
  panes: McpPaneLayout[]
}

interface McpWorkspaceLayout {
  id: string
  name: string
  active: boolean
  tabs: McpTabLayout[]
}

interface McpCaller {
  workspace: string
  tab: string
  pane: string
}

export interface McpLayout {
  caller: McpCaller | null
  workspaces: McpWorkspaceLayout[]
}

const agentOf = (agent: PaneAgent | undefined): McpPaneAgent | undefined => (agent ? { name: agent.agent, state: agent.state, message: agent.message } : undefined)

const browserOf = (pane: Pane, state: BrowserState | undefined): McpBrowserLayout =>
  isBrowserPane(pane) ? { kind: 'browser', url: state?.url || pane.url, title: state?.title || undefined, viewport: pane.viewport ?? BrowserViewport.Desktop, errors: state?.errors } : {}

const ownershipOf = (owner: string | undefined, callerPane: string | undefined): McpOwnership => (owner ? { owner, mine: owner === callerPane ? true : undefined } : {})

export const layoutOf = (session: Session, agents: Record<string, PaneAgent>, browsers: Record<string, BrowserState>, callerPane: string | undefined, started: (paneId: string) => boolean): McpLayout => {
  let caller: McpCaller | null = null
  const workspaces = session.workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    active: workspace.id === session.active,
    tabs: workspace.tabs.map((tab) => ({
      id: tab.id,
      name: tab.name,
      active: tab.id === workspace.active,
      ...ownershipOf(tab.owner, callerPane),
      panes: panesOf(tab.tree).map((pane) => {
        const isCaller = pane.id === callerPane
        if (isCaller) {
          caller = { workspace: workspace.id, tab: tab.id, pane: pane.id }
        }
        return {
          id: pane.id,
          path: pane.path,
          shell: pane.shell,
          active: pane.id === tab.active,
          started: started(pane.id),
          caller: isCaller ? (true as const) : undefined,
          ...ownershipOf(pane.owner, callerPane),
          ...browserOf(pane, browsers[pane.id]),
          agent: agentOf(agents[pane.id]),
        }
      }),
    })),
  }))
  return { caller, workspaces }
}
