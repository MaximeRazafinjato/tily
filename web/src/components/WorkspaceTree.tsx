import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Session } from '../model/session'
import { useAgentStore } from '../store/agentStore'
import { useHostStore } from '../store/hostStore'
import { WorktreePickerKind } from '../store/worktreeStore'
import { openWorktreePicker } from '../worktree/worktreeActions'
import { worktreesOfTabs } from '../worktree/worktreePaths'
import { useUiStore } from '../store/uiStore'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { WorkspaceContextMenu } from './WorkspaceContextMenu'
import { WorkspaceItem } from './WorkspaceItem'
import { isWorkspaceDropTarget } from './workspaceDrag'
import { handlePanelRowKeys, menuPlaceOf, PANEL_DROP_LINE, type PanelMenuRequest, type WorkspacePanelActions } from './workspacePanel'
import { Command } from '../keyboard/commands'
import { useShortcutTip } from '../keyboard/shortcutLabels'

interface WorkspaceTreeProps {
  session: Session
  renamingWorkspaceId: string | null
  renamingTabId: string | null
  actions: WorkspacePanelActions
}

const NAME_SEPARATOR = '\n'
const HEADER_BUTTON = 'flex size-[24px] cursor-pointer items-center justify-center rounded-md text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink'

const handleCreateWorktree = (): void => openWorktreePicker(WorktreePickerKind.Source)

export function WorkspaceTree({ session, renamingWorkspaceId, renamingTabId, actions }: WorkspaceTreeProps) {
  const { draggingTabId, tabDropTarget, springWorkspaceIds, draggingWorkspaceId, workspaceDropTarget } = useUiStore(
    useShallow((state) => ({
      draggingTabId: state.draggingTabId,
      tabDropTarget: state.tabDropTarget,
      springWorkspaceIds: state.springWorkspaceIds,
      draggingWorkspaceId: state.draggingWorkspaceId,
      workspaceDropTarget: state.workspaceDropTarget,
    })),
  )
  const agents = useAgentStore((state) => state.agents)
  const openProjectTip = useShortcutTip('Ouvrir un projet', Command.Projects)
  const createWorktreeTip = useShortcutTip('Créer un worktree depuis un projet', Command.CreateWorktree)
  const newWorkspaceTip = useShortcutTip('Nouveau workspace', Command.NewWorkspace)
  const [menu, setMenu] = useState<PanelMenuRequest | null>(null)
  const namesKey = session.workspaces.map((workspace) => workspace.name).join(NAME_SEPARATOR)
  const workspaceNames = useMemo(() => namesKey.split(NAME_SEPARATOR), [namesKey])

  const handleOpenMenu = useCallback((request: PanelMenuRequest) => setMenu(request), [])
  const handleRunMenu = useCallback(() => setMenu(null), [])
  const handleDismissMenu = useCallback(() => {
    const returnFocus = menu?.returnFocus
    setMenu(null)
    if (returnFocus?.isConnected) {
      returnFocus.focus()
    }
  }, [menu])

  return (
    <aside className="@container flex h-full min-h-0 flex-col bg-tily-paper" style={{ width: session.sidebar }}>
      <div className="flex h-[36px] shrink-0 items-center gap-[2px] pr-[6px] pl-[12px] text-[11px] font-semibold tracking-[0.06em] text-tily-muted uppercase">
        <span className="flex-1">Workspaces</span>
        <button type="button" className={HEADER_BUTTON} aria-label="Ouvrir un projet" data-tip={openProjectTip} onClick={actions.openProjects}>
          <Icon name={IconName.Project} />
        </button>
        <button type="button" className={HEADER_BUTTON} aria-label="Créer un worktree" data-tip={createWorktreeTip} onClick={handleCreateWorktree}>
          <Icon name={IconName.Worktree} />
        </button>
        <button type="button" className={HEADER_BUTTON} aria-label="Nouveau workspace" data-tip={newWorkspaceTip} onClick={actions.newWorkspace}>
          <Icon name={IconName.Plus} />
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-auto px-[8px] pb-[8px]" data-workspace-list="" onKeyDown={handlePanelRowKeys}>
        {session.workspaces.map((workspace) => (
          <WorkspaceItem
            key={workspace.id}
            workspace={workspace}
            workspaceNames={workspaceNames}
            selected={workspace.id === session.active}
            renaming={workspace.id === renamingWorkspaceId}
            renamingTabId={workspace.tabs.some((tab) => tab.id === renamingTabId) ? renamingTabId : null}
            springOpen={springWorkspaceIds.includes(workspace.id)}
            agents={agents}
            draggingTabId={workspace.tabs.some((tab) => tab.id === draggingTabId) ? draggingTabId : null}
            dropTarget={tabDropTarget?.workspaceId === workspace.id ? tabDropTarget : null}
            draggingSelf={workspace.id === draggingWorkspaceId}
            dropBefore={draggingWorkspaceId !== null && isWorkspaceDropTarget(workspaceDropTarget, workspace.id)}
            actions={actions}
            onOpenMenu={handleOpenMenu}
          />
        ))}
        {draggingWorkspaceId !== null && isWorkspaceDropTarget(workspaceDropTarget) && (
          <div aria-hidden="true" className="relative h-[4px]">
            <span className={PANEL_DROP_LINE} />
          </div>
        )}
      </nav>
      {menu && (
        <WorkspaceContextMenu
          request={menu}
          place={menuPlaceOf(session, menu)}
          actions={actions}
          worktrees={worktreesOfTabs(session, menu.workspaceId, menu.tabId, useHostStore.getState().contexts)}
          onRun={handleRunMenu}
          onDismiss={handleDismissMenu}
        />
      )}
    </aside>
  )
}
