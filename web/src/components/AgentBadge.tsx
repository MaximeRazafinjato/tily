import type { PaneAgent } from '../bridge/messages'
import { describeAgent } from '../agents/agentSummary'
import { AgentStateIcon } from './AgentStateIcon'

interface AgentBadgeProps {
  agent: PaneAgent
}

export function AgentBadge({ agent }: AgentBadgeProps) {
  return (
    <span role="status" className="mr-1 inline-flex shrink-0 items-center">
      <AgentStateIcon state={agent.state} tip={describeAgent(agent)} />
    </span>
  )
}
