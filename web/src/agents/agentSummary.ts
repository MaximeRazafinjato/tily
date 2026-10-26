import { AgentState, type PaneAgent } from '../bridge/messages'
import { folderName, panesOf, type Session, type Tab, type Workspace } from '../model/session'

const AGENT_LABELS: Record<string, string> = { claude: 'Claude Code', codex: 'Codex CLI' }

export const STATE_LABELS: Record<AgentState, string> = {
  [AgentState.Working]: 'En cours',
  [AgentState.Waiting]: 'En attente',
  [AgentState.Done]: 'Terminé',
  [AgentState.Error]: 'En erreur',
  [AgentState.Unknown]: 'État inconnu',
}

export interface WaitingPane {
  paneId: string
  workspaceId: string
  tabId: string
  workspaceName: string
  tabName: string
  label: string
  folder: string
  detail: string
  reason: string
}

export interface AttentionNotice {
  title: string
  body: string
}

export type AgentMap = Record<string, PaneAgent>

export const agentLabel = (agent: PaneAgent): string => AGENT_LABELS[agent.agent] ?? agent.agent

export const describeAgent = (agent: PaneAgent): string => {
  const base = `${agentLabel(agent)} : ${STATE_LABELS[agent.state]}`
  return [base, agent.message, agent.detail].filter(Boolean).join(' — ')
}

export const attentionReason = (agent: PaneAgent): string =>
  agent.state === AgentState.Done ? STATE_LABELS[agent.state] : (agent.message ?? STATE_LABELS[agent.state])

export const attentionNotice = (pane: WaitingPane): AttentionNotice => ({
  title: `${pane.workspaceName} › ${pane.tabName}`,
  body: pane.reason,
})

const STATE_PRIORITY: AgentState[] = [AgentState.Waiting, AgentState.Error, AgentState.Working, AgentState.Unknown, AgentState.Done]

export type StateCounts = Partial<Record<AgentState, number>>

const countStates = (panes: { id: string }[], agents: AgentMap): StateCounts => {
  const counts: StateCounts = {}
  for (const pane of panes) {
    const agent = agents[pane.id]
    if (agent) {
      counts[agent.state] = (counts[agent.state] ?? 0) + 1
    }
  }
  return counts
}

const dominantState = (counts: StateCounts): AgentState | undefined => STATE_PRIORITY.find((state) => (counts[state] ?? 0) > 0)

export const tabAgents = (tab: Tab, agents: AgentMap): { state: AgentState; tip: string } | null => {
  const described = panesOf(tab.tree)
    .map((pane) => agents[pane.id])
    .filter((agent): agent is PaneAgent => agent !== undefined)
  const state = dominantState(countStates(panesOf(tab.tree), agents))
  return state ? { state, tip: described.map(describeAgent).join(' · ') } : null
}

export const workspaceStateCounts = (workspace: Workspace, agents: AgentMap): StateCounts =>
  countStates(
    workspace.tabs.flatMap((tab) => panesOf(tab.tree)),
    agents,
  )

interface StateAlert {
  state: AgentState
  count: number
}

export interface WorkspaceSummary {
  alerts: StateAlert[]
  activity: AgentState | undefined
}

const ALERT_STATES: AgentState[] = [AgentState.Waiting, AgentState.Error]

const ACTIVITY_STATES: AgentState[] = [AgentState.Working, AgentState.Done]

export const workspaceSummary = (counts: StateCounts): WorkspaceSummary => ({
  alerts: ALERT_STATES.filter((state) => (counts[state] ?? 0) > 0).map((state) => ({ state, count: counts[state] ?? 0 })),
  activity: ACTIVITY_STATES.find((state) => (counts[state] ?? 0) > 0),
})

export const alertStateCounts = (workspaces: Workspace[], agents: AgentMap): StateCounts => {
  const counts = countStates(
    workspaces.flatMap((workspace) => workspace.tabs.flatMap((tab) => panesOf(tab.tree))),
    agents,
  )
  const alerts: StateCounts = {}
  for (const state of ALERT_STATES) {
    if (counts[state]) {
      alerts[state] = counts[state]
    }
  }
  return alerts
}

export const stateBreakdown = (counts: StateCounts): string =>
  STATE_PRIORITY.filter((state) => (counts[state] ?? 0) > 0)
    .map((state) => `${STATE_LABELS[state]} : ${counts[state]}`)
    .join(' · ')

export const nextPaneInState = (tabs: Tab[], agents: AgentMap, state: AgentState, currentPaneId?: string): string | undefined => {
  const candidates = tabs
    .flatMap((tab) => panesOf(tab.tree))
    .filter((pane) => agents[pane.id]?.state === state)
    .map((pane) => pane.id)
  const index = currentPaneId === undefined ? -1 : candidates.indexOf(currentPaneId)
  return candidates[(index + 1) % candidates.length]
}

const MINUTE_MS = 60_000
const MINUTES_PER_HOUR = 60

export const waitedFor = (elapsedMs: number): string => {
  const minutes = Math.floor(elapsedMs / MINUTE_MS)
  if (minutes < 1) {
    return 'depuis moins d’une minute'
  }
  return `depuis ${waitedShort(elapsedMs)}`
}

export const waitedShort = (elapsedMs: number): string => {
  const minutes = Math.floor(elapsedMs / MINUTE_MS)
  if (minutes < 1) {
    return '< 1 min'
  }
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} min`
  }
  return `${Math.floor(minutes / MINUTES_PER_HOUR)} h ${String(minutes % MINUTES_PER_HOUR).padStart(2, '0')}`
}

export const longestWaitingFirst = (panes: WaitingPane[], since: Record<string, number>, now: number): WaitingPane[] =>
  panes.toSorted((first, second) => (since[first.paneId] ?? now) - (since[second.paneId] ?? now))

export const panesInState = (session: Session, agents: AgentMap, state: AgentState): WaitingPane[] =>
  session.workspaces.flatMap((workspace) =>
    workspace.tabs.flatMap((tab) =>
      panesOf(tab.tree)
        .filter((pane) => agents[pane.id]?.state === state)
        .map((pane) => ({
          paneId: pane.id,
          workspaceId: workspace.id,
          tabId: tab.id,
          workspaceName: workspace.name,
          tabName: tab.name,
          label: `${workspace.name} › ${tab.name} › ${folderName(pane.path)}`,
          folder: folderName(pane.path),
          detail: describeAgent(agents[pane.id]),
          reason: attentionReason(agents[pane.id]),
        })),
    ),
  )

export const waitingPanes = (session: Session, agents: AgentMap): WaitingPane[] => panesInState(session, agents, AgentState.Waiting)
