import { create } from 'zustand'
import type { PaneAgent } from '../bridge/messages'

export const agentKey = (agent: PaneAgent): string => `${agent.state}|${agent.message ?? ''}`

const sameAgent = (previous: PaneAgent | undefined, agent: PaneAgent): previous is PaneAgent => previous !== undefined && JSON.stringify(previous) === JSON.stringify(agent)

interface AgentStoreState {
  agents: Record<string, PaneAgent>
  acknowledged: Record<string, string>
  since: Record<string, number>
  setAgents: (panes: PaneAgent[]) => void
  acknowledge: (paneId: string) => void
}

export const useAgentStore = create<AgentStoreState>()((set) => ({
  agents: {},
  acknowledged: {},
  since: {},
  setAgents: (panes) =>
    set((state) => {
      const agents = Object.fromEntries(
        panes.map((agent) => {
          const previous = state.agents[agent.paneId]
          return [agent.paneId, sameAgent(previous, agent) ? previous : agent]
        }),
      )
      if (panes.length === Object.keys(state.agents).length && panes.every((agent) => agents[agent.paneId] === state.agents[agent.paneId])) {
        return state
      }
      const acknowledged = Object.fromEntries(Object.entries(state.acknowledged).filter(([paneId, key]) => agents[paneId] !== undefined && agentKey(agents[paneId]) === key))
      const now = Date.now()
      const since = Object.fromEntries(
        panes.map((agent) => {
          const previous = state.agents[agent.paneId]
          return [agent.paneId, previous && agentKey(previous) === agentKey(agent) ? (state.since[agent.paneId] ?? now) : now]
        }),
      )
      return { agents, acknowledged, since }
    }),
  acknowledge: (paneId) =>
    set((state) => {
      const agent = state.agents[paneId]
      return agent ? { acknowledged: { ...state.acknowledged, [paneId]: agentKey(agent) } } : state
    }),
}))
