import type { KeyboardEvent, MouseEvent } from 'react'
import type { AgentState } from '../bridge/messages'
import { nextPaneInState, type AgentMap, type StateCounts } from '../agents/agentSummary'
import type { Workspace } from '../model/session'
import { InlineNameEditor } from './InlineNameEditor'
import { TruncatedName } from './TruncatedName'
import { WorkspaceStatus } from './WorkspaceStatus'
import { CommandNoticeIcon } from './CommandNoticeIcon'
import { useCommandStore } from '../store/commandStore'
import { workspaceCommandNotice } from '../terminal/commandNotices'
import type { HeaderWorkspaceActions } from './workspaceStrip'

interface HeaderWorkspaceItemProps {
  workspace: Workspace
  siblings: string[]
  counts: StateCounts
  agents: AgentMap
  active: boolean
  shown: boolean
  renaming: boolean
  currentPaneId: string | undefined
  actions: HeaderWorkspaceActions
}

const placementOf = (shown: boolean): string => (shown ? '' : 'invisible absolute top-0 left-0')

const stateOf = (active: boolean): string => (active ? 'bg-tily-green-soft text-tily-green-deep' : 'text-tily-ink-soft hover:bg-tily-green-hover hover:text-tily-ink')

export function HeaderWorkspaceItem({ workspace, siblings, counts, agents, active, shown, renaming, currentPaneId, actions }: HeaderWorkspaceItemProps) {
  const { id, name, tabs } = workspace
  const commandNotice = useCommandStore((state) => workspaceCommandNotice(workspace, state.notices))

  const handleSelect = () => actions.select(id)
  const handleRename = () => actions.startRename(id)
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'F2') {
      event.preventDefault()
      handleRename()
    }
  }
  const handleJoin = (state: AgentState) => {
    const paneId = nextPaneInState(tabs, agents, state, currentPaneId)
    if (paneId) {
      actions.joinPane(paneId)
    }
  }
  const stopPropagation = (event: MouseEvent) => event.stopPropagation()

  return (
    <div
      data-strip-item={id}
      className={`flex h-[28px] w-max shrink-0 cursor-pointer items-center gap-[6px] rounded-md px-[8px] select-none ${placementOf(shown)} ${stateOf(active)}`}
      onClick={handleSelect}
    >
      {renaming ? (
        <span className="flex" onClick={stopPropagation}>
          <InlineNameEditor value={name} label="Nom du workspace" className="h-[22px] w-[200px] text-[13px]" onCommit={actions.commitRename} onCancel={actions.cancelRename} />
        </span>
      ) : (
        <button
          type="button"
          aria-current={active || undefined}
          data-tip={name}
          className="flex h-full max-w-[200px] min-w-0 cursor-pointer items-center text-left text-[13px]"
          onDoubleClick={handleRename}
          onKeyDown={handleKeyDown}
        >
          <TruncatedName name={name} siblings={siblings} />
        </button>
      )}
      {commandNotice && <CommandNoticeIcon notice={commandNotice} />}
      <WorkspaceStatus counts={counts} onJoin={handleJoin} />
    </div>
  )
}
