import { memo, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import type { AgentState } from '../bridge/messages'
import { nextPaneInState, workspaceStateCounts, type AgentMap } from '../agents/agentSummary'
import { activeTab, notePreview, type Workspace } from '../model/session'
import type { TabDropTarget } from '../store/uiStore'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { InlineNameEditor } from './InlineNameEditor'
import { isDropTarget } from './tabDrag'
import { beginWorkspaceDrag } from './workspaceDrag'
import { TruncatedName } from './TruncatedName'
import { WorkspaceStatus } from './WorkspaceStatus'
import { CommandNoticeIcon } from './CommandNoticeIcon'
import { useCommandStore } from '../store/commandStore'
import { workspaceCommandNotice } from '../terminal/commandNotices'
import { WorkspaceTabRow } from './WorkspaceTabRow'
import { COLLAPSE_KEY, EXPAND_KEY, isMenuKey, menuRequestFor, MOVE_KEYS, PANEL_CLOSE_BUTTON, PANEL_DROP_LINE, PANEL_NOTE_BUTTON, type PanelMenuRequest, type WorkspacePanelActions } from './workspacePanel'

interface WorkspaceItemProps {
  workspace: Workspace
  workspaceNames: string[]
  selected: boolean
  renaming: boolean
  renamingTabId: string | null
  springOpen: boolean
  agents: AgentMap
  draggingTabId: string | null
  dropTarget: TabDropTarget | null
  draggingSelf: boolean
  dropBefore: boolean
  actions: WorkspacePanelActions
  onOpenMenu: (request: PanelMenuRequest) => void
}

const tabCountTip = (count: number): string => (count === 1 ? '1 onglet dans ce workspace replié' : `${count} onglets dans ce workspace replié`)

const toggleTip = (expanded: boolean, count: number): string => `${expanded ? 'Replier' : 'Afficher'} ${count === 1 ? 'l’onglet' : `les ${count} onglets`}`

const rowStateOf = (dropInto: boolean, here: boolean): string => {
  if (dropInto) {
    return 'bg-tily-green-soft shadow-[inset_0_0_0_1px_var(--color-tily-focus)]'
  }
  return here ? 'bg-tily-green-soft' : 'hover:bg-tily-panel'
}

export const WorkspaceItem = memo(function WorkspaceItem({ workspace, workspaceNames, selected, renaming, renamingTabId, springOpen, agents, draggingTabId, dropTarget, draggingSelf, dropBefore, actions, onOpenMenu }: WorkspaceItemProps) {
  const { id, name, tabs } = workspace
  const expanded = springOpen || (workspace.expanded ?? selected)
  const commandNotice = useCommandStore((state) => workspaceCommandNotice(workspace, state.notices))
  const here = selected && !expanded
  const tabsId = `workspace-tabs-${id}`
  const currentPaneId = selected ? activeTab(workspace).active : undefined
  const tabNames = tabs.map((tab) => tab.name)
  const preview = notePreview(workspace.note)

  const handleSelect = () => actions.selectWorkspace(id)
  const handleNameClick = (event: MouseEvent) => {
    event.stopPropagation()
    actions.selectWorkspace(id)
  }
  const handleRename = () => actions.startRenameWorkspace(id)
  const handleToggle = (event: MouseEvent) => {
    event.stopPropagation()
    actions.toggleWorkspace(id)
  }
  const handleClose = (event: MouseEvent) => {
    event.stopPropagation()
    actions.closeWorkspace(id)
  }
  const handleOpenNotes = (event: MouseEvent) => {
    event.stopPropagation()
    actions.openNotes(id)
  }
  const handleJoin = (state: AgentState) => {
    const paneId = nextPaneInState(tabs, agents, state, currentPaneId)
    if (paneId) {
      actions.joinPane(paneId)
    }
  }
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    onOpenMenu({ workspaceId: id, x: event.clientX, y: event.clientY, returnFocus: null })
  }
  const handleNameKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'F2') {
      event.preventDefault()
      handleRename()
    } else if (isMenuKey(event)) {
      event.preventDefault()
      onOpenMenu(menuRequestFor(event, id))
    } else if (event.altKey && event.key in MOVE_KEYS) {
      event.preventDefault()
      actions.moveWorkspace(id, MOVE_KEYS[event.key])
    } else if (!event.altKey && ((event.key === EXPAND_KEY && !expanded) || (event.key === COLLAPSE_KEY && expanded))) {
      event.preventDefault()
      actions.toggleWorkspace(id)
    }
  }
  const stopPropagation = (event: MouseEvent) => event.stopPropagation()
  const handleHeaderPointerDown = (event: PointerEvent<HTMLDivElement>) => beginWorkspaceDrag(event, id, actions.moveWorkspaceBefore)

  return (
    <div className={`relative mb-[4px] ${draggingSelf ? 'opacity-50' : ''}`} data-workspace-slot={id}>
      {dropBefore && <span aria-hidden="true" className={PANEL_DROP_LINE} />}
      <div
        className={`group flex h-[30px] cursor-pointer items-center gap-[4px] rounded-md px-[2px] select-none ${rowStateOf(!expanded && isDropTarget(dropTarget, id), here)}`}
        data-drop-workspace={id}
        data-spring-workspace={expanded ? undefined : id}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        onPointerDown={handleHeaderPointerDown}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={tabsId}
          aria-label={`${expanded ? 'Replier' : 'Afficher'} ${tabs.length === 1 ? 'l’onglet' : `les ${tabs.length} onglets`} de ${name}`}
          data-tip={toggleTip(expanded, tabs.length)}
          className="flex size-[20px] shrink-0 cursor-pointer items-center justify-center rounded text-tily-muted hover:text-tily-ink"
          onClick={handleToggle}
        >
          <Icon name={IconName.Chevron} size={10} className={`translate-y-[0.5px] transition-transform duration-[120ms] ease-out ${expanded ? 'rotate-90' : ''}`} />
        </button>
        {renaming ? (
          <span className="flex min-w-0 flex-1" onClick={stopPropagation} onContextMenu={stopPropagation}>
            <InlineNameEditor value={name} label="Nom du workspace" className="h-[22px] min-w-0 flex-1 font-semibold" onCommit={actions.commitRenameWorkspace} onCancel={actions.cancelRenameWorkspace} />
          </span>
        ) : (
          <button
            type="button"
            data-panel-row=""
            data-row-name={name}
            aria-expanded={expanded}
            data-tip={`${name} · Double-clic pour renommer`}
            className={`flex h-full min-w-0 flex-1 cursor-pointer items-center text-left text-[13px] font-semibold ${here ? 'text-tily-green-deep' : 'text-tily-ink'}`}
            onClick={handleNameClick}
            onDoubleClick={handleRename}
            onKeyDown={handleNameKeyDown}
          >
            <TruncatedName name={name} siblings={workspaceNames} className="flex-1" />
          </button>
        )}
        {preview && (
          <button type="button" className={PANEL_NOTE_BUTTON} data-tip={`${preview} · Afficher les notes`} aria-label={`Afficher les notes de ${name}`} onClick={handleOpenNotes}>
            <Icon name={IconName.Note} size={11} />
          </button>
        )}
        {!expanded && (
          <span className="shrink-0 translate-y-px px-[2px] font-mono text-[11px] leading-none text-tily-muted tabular-nums" aria-hidden="true" data-tip={tabCountTip(tabs.length)}>
            {tabs.length}
          </span>
        )}
        {!expanded && commandNotice && <CommandNoticeIcon notice={commandNotice} />}
        <WorkspaceStatus counts={workspaceStateCounts(workspace, agents)} onJoin={handleJoin} />
        <button type="button" className={PANEL_CLOSE_BUTTON} data-tip="Fermer le workspace" aria-label={`Fermer le workspace ${name}`} onClick={handleClose}>
          <Icon name={IconName.Close} size={10} />
        </button>
      </div>
      {expanded && (
        <ul id={tabsId} className="relative mb-[4px] pl-[20px] before:absolute before:top-0 before:bottom-[14px] before:left-[12px] before:w-px before:bg-tily-line">
          {tabs.map((tab) => (
            <WorkspaceTabRow
              key={tab.id}
              workspaceId={id}
              tab={tab}
              siblings={tabNames}
              active={selected && tab.id === workspace.active}
              renaming={tab.id === renamingTabId}
              dragging={tab.id === draggingTabId}
              dropBefore={isDropTarget(dropTarget, id, tab.id)}
              currentPaneId={currentPaneId}
              agents={agents}
              actions={actions}
              onOpenMenu={onOpenMenu}
            />
          ))}
          <li aria-hidden="true" className="relative">
            {isDropTarget(dropTarget, id) && <span className={PANEL_DROP_LINE} />}
          </li>
        </ul>
      )}
    </div>
  )
})
