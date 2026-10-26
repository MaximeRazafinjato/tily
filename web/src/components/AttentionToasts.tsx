import { AgentState } from '../bridge/messages'
import { longestWaitingFirst, waitedFor, type WaitingPane } from '../agents/agentSummary'
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
        return (
          <div key={pane.paneId} role="status" className="pointer-events-auto rounded-lg border border-tily-status-waiting/60 bg-tily-panel px-3 py-2.5 text-[12px] shadow-xl">
            <div className="flex items-center gap-2">
              <AgentStateIcon state={AgentState.Waiting} tip="Une réponse est attendue" />
              <span className="min-w-0 flex-1 truncate font-semibold text-tily-ink" data-tip={pane.label}>{`${pane.workspaceName} › ${pane.tabName}`}</span>
              <span aria-hidden="true" className="shrink-0 text-[11px] text-tily-muted">
                {waitedFor(now - (since[pane.paneId] ?? now))}
              </span>
              <button type="button" className="flex size-[18px] shrink-0 translate-y-[0.5px] cursor-pointer items-center justify-center rounded text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink" aria-label="Ignorer cette notification" data-tip="Ignorer jusqu’au prochain changement d’état" onClick={handleDismiss}>
                <Icon name={IconName.Close} size={10} />
              </button>
            </div>
            <p className="mt-1.5 line-clamp-3 break-words text-tily-muted">{pane.detail}</p>
            <div className="mt-2 flex justify-end">
              <button type="button" className="cursor-pointer rounded border border-tily-status-waiting px-2.5 py-1 text-[12px] text-tily-status-waiting hover:bg-tily-green-hover" onClick={handleJoin}>
                Rejoindre le terminal ↗
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
