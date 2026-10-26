import { AgentState } from '../bridge/messages'
import { longestWaitingFirst, waitedFor, waitedShort, type WaitingPane } from '../agents/agentSummary'
import { useAgentStore } from '../store/agentStore'
import { AgentStateIcon } from './AgentStateIcon'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { useClock } from './useClock'

const CLOCK_INTERVAL_MS = 30_000

interface AttentionToastsProps {
  waiting: WaitingPane[]
  onJoin: (paneId: string) => void
  onDismiss: (paneId: string) => void
}

export function AttentionToasts({ waiting, onJoin, onDismiss }: AttentionToastsProps) {
  const since = useAgentStore((state) => state.since)
  const now = useClock(waiting.length > 0, CLOCK_INTERVAL_MS)
  if (waiting.length === 0) {
    return null
  }

  return (
    <div role="region" aria-live="polite" aria-label="Terminaux en attente" className="pointer-events-none absolute bottom-8 right-3 z-20 flex w-[380px] max-w-[calc(100vw-24px)] flex-col gap-2">
      {longestWaitingFirst(waiting, since, now).map((pane) => {
        const handleJoin = () => onJoin(pane.paneId)
        const handleDismiss = () => onDismiss(pane.paneId)
        const elapsed = now - (since[pane.paneId] ?? now)
        return (
          <div key={pane.paneId} role="status" className="pointer-events-auto flex items-start gap-1 rounded-lg border border-tily-status-waiting/60 bg-tily-panel py-1 pr-1.5 pl-1 text-[12px] shadow-xl hover:border-tily-status-waiting">
            <button type="button" className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 rounded px-2 py-1 text-left hover:bg-tily-green-hover" aria-label={`Rejoindre ${pane.label} : ${pane.reason}`} data-tip={`Rejoindre ${pane.label}`} onClick={handleJoin}>
              <span className="flex w-full items-center gap-2">
                <AgentStateIcon state={AgentState.Waiting} />
                <span className="min-w-0 flex-1 truncate font-semibold text-tily-ink">{`${pane.workspaceName} › ${pane.tabName}`}</span>
                <span aria-hidden="true" className="shrink-0 text-[11px] text-tily-muted" data-tip={waitedFor(elapsed)}>
                  {waitedShort(elapsed)}
                </span>
              </span>
              <span className="w-full truncate pl-5 text-tily-muted" data-tip={pane.reason}>{pane.reason}</span>
            </button>
            <button type="button" className="mt-1.5 flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink" aria-label="Ignorer cette notification" data-tip="Ignorer la notification" onClick={handleDismiss}>
              <Icon name={IconName.Close} size={10} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
