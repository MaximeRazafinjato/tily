import { AgentState, AttentionKind, type PaneAgent } from '../bridge/messages'
import { playAgentAlert } from '../ambiance/alerts/agentAlerts'
import { bridge } from '../bridge/bridge'
import { agentKey, useAgentStore } from '../store/agentStore'
import { useSessionStore } from '../store/sessionStore'
import { attentionNotice, panesInState, waitingPanes, type WaitingPane } from './agentSummary'

const seen: Record<string, string> = {}
let finished = new Set<string>()
let known = new Set<string>()

const isCompleted = (agent: PaneAgent): boolean => agent.state === AgentState.Done && !agent.interrupted

export const startAttentionNotifier = (): (() => void) =>
  useAgentStore.subscribe((state) => {
    const agents = Object.values(state.agents)
    const previouslyKnown = known
    const previouslyFinished = finished
    const previouslySeen = { ...seen }
    known = new Set(agents.map((agent) => agent.paneId))
    finished = new Set(agents.filter(isCompleted).map((agent) => agent.paneId))
    agents.filter((agent) => agent.state === AgentState.Waiting).forEach((agent) => {
      seen[agent.paneId] = agentKey(agent)
    })
    const { session } = useSessionStore.getState()
    if (!session) {
      return
    }
    const fresh = waitingPanes(session, state.agents).filter((pane) => {
      const key = agentKey(state.agents[pane.paneId])
      return previouslyKnown.has(pane.paneId) && previouslySeen[pane.paneId] !== key && state.acknowledged[pane.paneId] !== key
    })
    const justFinished = panesInState(session, state.agents, AgentState.Done).filter(
      (pane) => previouslyKnown.has(pane.paneId) && isCompleted(state.agents[pane.paneId]) && !previouslyFinished.has(pane.paneId),
    )
    const raise = (pane: WaitingPane, kind: AttentionKind) => bridge.send({ type: 'attention.raise', pane: pane.paneId, kind, ...attentionNotice(pane) })
    fresh.forEach((pane) => raise(pane, AttentionKind.Waiting))
    justFinished.forEach((pane) => raise(pane, AttentionKind.Done))
    if (fresh.length > 0) {
      playAgentAlert(AttentionKind.Waiting)
    }
    if (justFinished.length > 0) {
      playAgentAlert(AttentionKind.Done)
    }
  })
