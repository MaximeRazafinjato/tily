import { AgentState } from '../bridge/messages'
import { STATE_LABELS } from '../agents/agentSummary'

interface AgentStateIconProps {
  state: AgentState
  tip?: string
  size?: number
}

const STATE_COLOR_CLASSES: Record<AgentState, string> = {
  [AgentState.Working]: 'text-tily-status-working',
  [AgentState.Waiting]: 'text-tily-status-waiting',
  [AgentState.Done]: 'text-tily-status-done',
  [AgentState.Error]: 'text-tily-status-error',
  [AgentState.Unknown]: 'text-tily-status-unknown',
}

const ICON_PROPS = { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const renderShape = (state: AgentState) => {
  switch (state) {
    case AgentState.Working:
      return <path className="origin-center animate-[spin_1.6s_linear_infinite] motion-reduce:animate-none" d="M6 1.5a4.5 4.5 0 1 1-4.2 2.9" />
    case AgentState.Waiting:
      return (
        <>
          <circle cx="6" cy="6" r="4.6" fill="currentColor" stroke="none" />
          <path d="M6 3.4v3M6 8.6v.1" stroke="var(--color-tily-terminal)" />
        </>
      )
    case AgentState.Done:
      return (
        <>
          <circle cx="6" cy="6" r="4.6" />
          <path d="M3.8 6.2 5.3 7.6 8.3 4.5" />
        </>
      )
    case AgentState.Error:
      return (
        <>
          <circle cx="6" cy="6" r="4.6" fill="currentColor" stroke="none" />
          <path d="M4.2 4.2l3.6 3.6M7.8 4.2l-3.6 3.6" stroke="var(--color-tily-terminal)" />
        </>
      )
    default:
      return (
        <>
          <circle cx="6" cy="6" r="4.6" />
          <path d="M4.6 4.8a1.4 1.4 0 1 1 2 1.3c-.4.2-.6.5-.6.9M6 8.7v.1" />
        </>
      )
  }
}

export function AgentStateIcon({ state, tip, size = 12 }: AgentStateIconProps) {
  const label = tip ?? STATE_LABELS[state]
  return (
    <span role="img" aria-label={label} data-tip={label} className={`inline-flex shrink-0 items-center ${STATE_COLOR_CLASSES[state]}`}>
      <svg {...ICON_PROPS} width={size} height={size} aria-hidden="true">
        {renderShape(state)}
      </svg>
    </span>
  )
}
