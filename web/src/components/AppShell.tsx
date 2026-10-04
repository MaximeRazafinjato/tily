import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { bridge } from '../bridge/bridge'
import { PickTarget, type AttentionKind, type NotificationSettings, type Settings } from '../bridge/messages'
import { activePane, activeTab, activeWorkspace, DEFAULT_SHELL, EXPLORER_DEFAULT, EXPLORER_MAX, EXPLORER_MIN, findWorkspace, RightPanelView, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, type Session, type SplitAxis, type SplitPath, type Workspace } from '../model/session'
import { toggleFavoriteCommand, type PaletteItem } from '../palette/paletteItems'
import { waitingPanes } from '../agents/agentSummary'
import { Command, handleDocumentShortcut, handleLeaderKeyCapture, runCommand } from '../keyboard/shortcuts'
import { agentKey, useAgentStore } from '../store/agentStore'
import { useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { RenameOrigin, useUiStore } from '../store/uiStore'
import { cancelClose, confirmClose } from '../terminal/closeGuard'
import { confirmDelete, focusFileTree } from '../explorer/fileExplorerActions'
import { useExplorerStore } from '../store/explorerStore'
import { focusGitPanel, takeFocusFromCoveredTerminals } from '../git/gitFocus'
import { openWorkspaceNotes, toggleRightPanel } from '../panel/rightPanel'
import { useGitStore } from '../store/gitStore'
import { usePreviewStore } from '../store/previewStore'
import { useMcpConsentStore } from '../store/mcpConsentStore'
import { usePasteStore } from '../store/pasteStore'
import { worktreeModalOpen } from '../store/worktreeStore'
import { filePickerOpen } from '../store/filePickerStore'
import { commitPickerOpen } from '../store/commitPickerStore'
import { changePaneShell, dismissPaneState, restartPane, restartPaneIn } from '../terminal/paneLifecycle'
import { closeOtherTabsKeepingText, closePaneKeepingText, closeTabKeepingText, closeWorkspaceKeepingText, duplicateTabKeepingLayout, restoreClosedTab } from '../terminal/tabLifecycle'
import { focusPane, joinPane } from '../terminal/terminalActions'
import { togglePaneZoom, useEndZoomWhenPaneChanges, zoomedPaneOf } from '../terminal/paneZoom'
import { AttentionToasts } from './AttentionToasts'
import { CloseConfirmDialog } from './CloseConfirmDialog'
import { McpConsentDialog } from './McpConsentDialog'
import { PasteConfirmDialog } from './PasteConfirmDialog'
import { CommandPalette } from './CommandPalette'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { EmptyState } from './EmptyState'
import { GitConfirmDialog } from './GitConfirmDialog'
import { GitContextMenu } from './GitContextMenu'
import { LazyFilePreview } from './LazyFilePreview'
import { UnsavedPreviewDialog } from './UnsavedPreviewDialog'
import { GitDiffDrawer } from './GitDiffDrawer'
import { GitGraphView } from './GitGraphView'
import { Header } from './Header'
import { HeaderWorkspaces } from './HeaderWorkspaces'
import { ProjectPickers } from './ProjectPickers'
import { FilePicker } from './FilePicker'
import { CommitPicker } from './CommitPicker'
import { RightPanel } from './RightPanel'
import { SettingsDialog } from './SettingsDialog'
import { SidebarResizer } from './SidebarResizer'
import { SplitView } from './SplitView'
import { StatusBar } from './StatusBar'
import { TabBar } from './TabBar'
import { Tooltip } from './Tooltip'
import { useWindowTitle } from './useWindowTitle'
import type { WorkspacePanelActions } from './workspacePanel'
import type { HeaderWorkspaceActions } from './workspaceStrip'
import { WorkspaceTree } from './WorkspaceTree'
import { WorktreeDialogs } from './WorktreeDialogs'

interface AppShellProps {
  session: Session
}

const currentWorkspace = (): Workspace | undefined => {
  const { session } = useSessionStore.getState()
  return session ? activeWorkspace(session) : undefined
}

const focusActivePane = (): void => {
  const workspace = currentWorkspace()
  if (workspace) {
    focusPane(activeTab(workspace).active)
  }
}

const finishRename = (): void => {
  useUiStore.getState().stopRenamingWorkspace()
  focusActivePane()
}

const handleCommitRename = (name: string): void => {
  const { renamingWorkspaceId } = useUiStore.getState()
  if (renamingWorkspaceId) {
    useSessionStore.getState().renameWorkspace(renamingWorkspaceId, name)
  }
  finishRename()
}

const handleStartRenameFromPanel = (workspaceId: string): void => useUiStore.getState().startRenamingWorkspace(workspaceId, RenameOrigin.Panel)

const finishTabRename = (): void => {
  useUiStore.getState().stopRenamingTab()
  focusActivePane()
}

const handleCommitTabRename = (name: string): void => {
  const { renamingTabId } = useUiStore.getState()
  if (renamingTabId) {
    useSessionStore.getState().renameTab(renamingTabId, name)
  }
  finishTabRename()
}

const handleSelectTab = (workspaceId: string, tabId: string): void => {
  const { selectWorkspace, selectTab } = useSessionStore.getState()
  selectWorkspace(workspaceId)
  selectTab(tabId)
  const { session } = useSessionStore.getState()
  const target = session ? findWorkspace(session, workspaceId)?.tabs.find((candidate) => candidate.id === tabId) : undefined
  if (target) {
    focusPane(target.active)
  }
}

const handleSplit = (paneId: string, axis: SplitAxis): void => {
  const { selectPane, splitPane } = useSessionStore.getState()
  selectPane(paneId)
  splitPane(axis)
}

const handleJoinPane = (paneId: string): void => joinPane(paneId)

const handleSelectWorkspace = (workspaceId: string): void => {
  useSessionStore.getState().selectWorkspace(workspaceId)
  focusActivePane()
}

const headerActions: HeaderWorkspaceActions = {
  select: handleSelectWorkspace,
  joinPane: handleJoinPane,
  startRename: (workspaceId) => useUiStore.getState().startRenamingWorkspace(workspaceId, RenameOrigin.Header),
  commitRename: handleCommitRename,
  cancelRename: finishRename,
}

const handleNewWorkspace = (): void => {
  const { session, newWorkspace } = useSessionStore.getState()
  const workspaceId = newWorkspace(`Workspace ${(session?.workspaces.length ?? 0) + 1}`, useHostStore.getState().home, DEFAULT_SHELL)
  useUiStore.getState().startRenamingWorkspace(workspaceId, RenameOrigin.Panel)
}

const handleOpenProjects = (): void => runCommand(Command.Projects)

const handleNewTabIn = (workspaceId: string): void => {
  const { selectWorkspace, newTab } = useSessionStore.getState()
  selectWorkspace(workspaceId)
  newTab(DEFAULT_SHELL)
}

const handleOpenTerminalAt = (path: string): void => {
  const { session, newTabAt } = useSessionStore.getState()
  const workspace = session ? activeWorkspace(session) : undefined
  newTabAt(path, workspace ? activePane(activeTab(workspace)).shell : DEFAULT_SHELL)
}

const handleCancelDelete = (): void => {
  useExplorerStore.getState().cancelDelete()
  focusFileTree()
}

const handleConfirmGit = (): void => {
  const { confirmation, confirm } = useGitStore.getState()
  confirm(null)
  confirmation?.run()
  requestAnimationFrame(confirmation?.restoreFocus ?? focusGitPanel)
}

const handleCancelGit = (): void => {
  const { confirmation, confirm } = useGitStore.getState()
  const restoreFocus = confirmation?.restoreFocus ?? focusGitPanel
  confirm(null)
  restoreFocus()
}

const confirmationOpen = (): boolean => {
  const { settingsOpen, closeConfirmation } = useUiStore.getState()
  return settingsOpen || closeConfirmation !== null || useExplorerStore.getState().deleteRequest !== null || useGitStore.getState().confirmation !== null || usePasteStore.getState().request !== null || useMcpConsentStore.getState().queue.length > 0 || worktreeModalOpen() || filePickerOpen() || commitPickerOpen() || usePreviewStore.getState().pendingAction !== null
}

const modalOpen = (): boolean => {
  const { paletteOpen, projectPickerOpen } = useUiStore.getState()
  return paletteOpen || projectPickerOpen || confirmationOpen()
}

const panelActions: WorkspacePanelActions = {
  selectWorkspace: (workspaceId) => useSessionStore.getState().selectWorkspace(workspaceId),
  toggleWorkspace: (workspaceId) => useSessionStore.getState().toggleWorkspace(workspaceId),
  startRenameWorkspace: handleStartRenameFromPanel,
  commitRenameWorkspace: handleCommitRename,
  cancelRenameWorkspace: finishRename,
  closeWorkspace: closeWorkspaceKeepingText,
  openNotes: openWorkspaceNotes,
  newTabIn: handleNewTabIn,
  collapseOthers: (workspaceId) => useSessionStore.getState().collapseOtherWorkspaces(workspaceId),
  moveWorkspace: (workspaceId, offset) => useSessionStore.getState().moveWorkspace(workspaceId, offset),
  moveWorkspaceBefore: (workspaceId, beforeWorkspaceId) => useSessionStore.getState().moveWorkspaceBefore(workspaceId, beforeWorkspaceId),
  shiftTab: (tabId, offset) => useSessionStore.getState().shiftTab(tabId, offset),
  duplicateTab: duplicateTabKeepingLayout,
  selectTab: handleSelectTab,
  startRenameTab: (tabId) => useUiStore.getState().startRenamingTab(tabId, RenameOrigin.Panel),
  commitRenameTab: handleCommitTabRename,
  cancelRenameTab: finishTabRename,
  closeTab: closeTabKeepingText,
  moveTab: (tabId, workspaceId, beforeTabId) => useSessionStore.getState().moveTab(tabId, workspaceId, beforeTabId),
  joinPane: handleJoinPane,
  newWorkspace: handleNewWorkspace,
  openProjects: handleOpenProjects,
}

export function AppShell({ session }: AppShellProps) {
  const { selectTab, selectPane, toggleSidebar, setSidebarWidth, setExplorerWidth, newTab, moveTab, shiftTab, setSplitRatio } = useSessionStore.getState()
  const { leaderActive, shells, settingsSnapshot, pickedPath, importedPreferences } = useHostStore(
    useShallow((state) => ({
      leaderActive: state.leaderActive,
      shells: state.shells,
      settingsSnapshot: state.settingsSnapshot,
      pickedPath: state.pickedPath,
      importedPreferences: state.importedPreferences,
    })),
  )
  const { renamingWorkspaceId, renameOrigin, renamingTabId, tabRenameOrigin, paletteOpen, projectPickerOpen, settingsOpen, closeConfirmation, zoomedPaneId } = useUiStore(
    useShallow((state) => ({
      zoomedPaneId: state.zoomedPaneId,
      renamingWorkspaceId: state.renamingWorkspaceId,
      renameOrigin: state.renameOrigin,
      renamingTabId: state.renamingTabId,
      tabRenameOrigin: state.tabRenameOrigin,
      paletteOpen: state.paletteOpen,
      projectPickerOpen: state.projectPickerOpen,
      settingsOpen: state.settingsOpen,
      closeConfirmation: state.closeConfirmation,
    })),
  )
  const { startRenamingWorkspace, startRenamingTab, openPalette, closePalette, openSettings, closeSettings } = useUiStore.getState()
  const deleteRequest = useExplorerStore((state) => state.deleteRequest)
  const gitConfirmation = useGitStore((state) => state.confirmation)
  const unsavedPreview = usePreviewStore((state) => state.pendingAction !== null)
  const gitGraphReady = useGitStore((state) => state.graphOpen && state.state !== null)
  const agents = useAgentStore((state) => state.agents)
  const acknowledged = useAgentStore((state) => state.acknowledged)
  const waiting = waitingPanes(session, agents).filter((pane) => acknowledged[pane.paneId] !== agentKey(agents[pane.paneId]))
  const workspace = activeWorkspace(session)
  const tab = workspace ? activeTab(workspace) : undefined
  const panelView = tab?.panel ?? RightPanelView.Files
  const gitShown = Boolean(tab?.explorer) && panelView === RightPanelView.Git
  const filesShown = Boolean(tab?.explorer) && panelView === RightPanelView.Files
  const graphShown = gitShown && gitGraphReady
  const tabId = tab?.id
  const activePaneId = tab?.active

  useWindowTitle(workspace, tab)
  useEndZoomWhenPaneChanges(zoomedPaneId, tab)
  const availableShells = useMemo(() => shells.filter((shell) => shell.available), [shells])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'p' && !confirmationOpen()) {
        event.preventDefault()
        openPalette()
      }
      if (!modalOpen()) {
        handleDocumentShortcut(event)
      }
    }
    document.addEventListener('keydown', handleLeaderKeyCapture, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleLeaderKeyCapture, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openPalette])

  useEffect(() => {
    if (graphShown) {
      takeFocusFromCoveredTerminals()
    }
  }, [graphShown, tabId, activePaneId, zoomedPaneId])

  const handleClosePalette = () => {
    closePalette()
    focusActivePane()
    if (graphShown) {
      takeFocusFromCoveredTerminals()
    }
  }
  const handleRunPaletteItem = (item: PaletteItem) => {
    handleClosePalette()
    item.run()
  }
  const handleOpenSettings = () => {
    bridge.send({ type: 'settings.get' })
    openSettings()
  }
  const handleCloseSettings = () => {
    closeSettings()
    focusActivePane()
  }
  const handleSaveSettings = (settings: Settings, baseSettings: Settings) => bridge.send({ type: 'settings.save', settings, baseSettings })
  const handleCancelClose = () => {
    cancelClose()
    focusActivePane()
  }
  const handlePickPath = (field: string, target: PickTarget) => bridge.send({ type: 'dialog.pick', field, target })
  const handleExportPreferences = () => bridge.send({ type: 'settings.export' })
  const handleImportPreferences = () => bridge.send({ type: 'settings.import' })
  const handleInstallHooks = () => bridge.send({ type: 'agents.installHooks' })
  const handleRemoveHooks = () => bridge.send({ type: 'agents.removeHooks' })
  const handleTestNotification = (notifications: NotificationSettings, kind: AttentionKind) => bridge.send({ type: 'attention.test', pane: tab?.active ?? '', kind, notifications })
  const handleDismissAttention = (paneId: string) => useAgentStore.getState().acknowledge(paneId)
  const handleToggleSidebar = () => {
    if (!session.sidebarCollapsed && document.activeElement?.closest('aside')) {
      focusActivePane()
    }
    toggleSidebar()
  }
  const handleStartRename = () => {
    if (workspace) {
      startRenamingWorkspace(workspace.id, RenameOrigin.Header)
    }
  }

  const renderMain = (current: Workspace) => {
    const currentTab = activeTab(current)
    const zoomedPane = zoomedPaneOf(currentTab, zoomedPaneId)
    const handleResize = (path: SplitPath, ratio: number) => setSplitRatio(currentTab.id, path, ratio)
    return (
      <>
        <TabBar
          workspace={current}
          shells={availableShells}
          renamingTabId={tabRenameOrigin === RenameOrigin.TabBar ? renamingTabId : null}
          panelOpen={Boolean(currentTab.explorer)}
          onTogglePanel={toggleRightPanel}
          onSelect={selectTab}
          onStartRename={startRenamingTab}
          onCommitRename={handleCommitTabRename}
          onCancelRename={finishTabRename}
          onClose={closeTabKeepingText}
          onCloseOthers={closeOtherTabsKeepingText}
          onShift={shiftTab}
          onDuplicate={duplicateTabKeepingLayout}
          onNew={newTab}
          onMove={moveTab}
        />
        <div className="relative min-h-0 flex-1 border-t border-tily-line bg-tily-panel p-1">
          <SplitView key={currentTab.id} node={zoomedPane ? { pane: zoomedPane } : currentTab.tree} zoomed={zoomedPane !== undefined} onToggleZoom={togglePaneZoom} activePaneId={currentTab.active} onFocus={selectPane} onClose={closePaneKeepingText} onSplit={handleSplit} onResize={handleResize} shells={availableShells} onRestart={restartPane} onRestartIn={restartPaneIn} onChangeShell={changePaneShell} onDismissState={dismissPaneState} />
          {graphShown && <GitGraphView layout={session.gitGraph} />}
          {gitShown && <GitDiffDrawer />}
          {filesShown && <LazyFilePreview />}
          {gitShown && <GitContextMenu />}
        </div>
      </>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <Header
        workspaceName={workspace?.name ?? null}
        renaming={workspace !== undefined && renamingWorkspaceId === workspace.id && renameOrigin === RenameOrigin.Header}
        sidebarCollapsed={session.sidebarCollapsed}
        leaderActive={leaderActive}
        navigation={
          session.sidebarCollapsed && workspace ? (
            <HeaderWorkspaces workspaces={session.workspaces} activeId={session.active} renamingId={renameOrigin === RenameOrigin.Header ? renamingWorkspaceId : null} actions={headerActions} />
          ) : null
        }
        onToggleSidebar={handleToggleSidebar}
        onOpenSettings={handleOpenSettings}
        onStartRename={handleStartRename}
        onCommitRename={handleCommitRename}
        onCancelRename={finishRename}
      />
      <div className="flex min-h-0 flex-1">
        {!session.sidebarCollapsed && (
          <>
            <WorkspaceTree
              session={session}
              renamingWorkspaceId={renameOrigin === RenameOrigin.Panel ? renamingWorkspaceId : null}
              renamingTabId={tabRenameOrigin === RenameOrigin.Panel ? renamingTabId : null}
              actions={panelActions}
            />
            <SidebarResizer width={session.sidebar} min={SIDEBAR_MIN} max={SIDEBAR_MAX} defaultWidth={SIDEBAR_DEFAULT} label="Largeur du panneau des workspaces" onResize={setSidebarWidth} />
          </>
        )}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {workspace ? renderMain(workspace) : <EmptyState canRestore={session.closed.length > 0} onNewWorkspace={handleNewWorkspace} onOpenProject={handleOpenProjects} onRestoreTab={restoreClosedTab} />}
        </main>
        {tab?.explorer && (
          <>
            <SidebarResizer width={session.explorerWidth} min={EXPLORER_MIN} max={EXPLORER_MAX} defaultWidth={EXPLORER_DEFAULT} label="Largeur du panneau de droite" reversed onResize={setExplorerWidth} />
            <RightPanel view={panelView} root={activePane(tab).path} width={session.explorerWidth} onClose={toggleRightPanel} onOpenTerminal={handleOpenTerminalAt} />
          </>
        )}
      </div>
      <AttentionToasts waiting={waiting} onJoin={handleJoinPane} onDismiss={handleDismissAttention} />
      <FilePicker />
      <CommitPicker />
      {projectPickerOpen && <ProjectPickers />}
      {settingsOpen && <SettingsDialog snapshot={settingsSnapshot} pickedPath={pickedPath} imported={importedPreferences} onClose={handleCloseSettings} onSave={handleSaveSettings} onPick={handlePickPath} onExport={handleExportPreferences} onImport={handleImportPreferences} onInstallHooks={handleInstallHooks} onRemoveHooks={handleRemoveHooks} onTestNotification={handleTestNotification} />}
      {paletteOpen && <CommandPalette session={session} shells={availableShells} onClose={handleClosePalette} onRun={handleRunPaletteItem} onToggleFavorite={toggleFavoriteCommand} />}
      {deleteRequest && <DeleteConfirmDialog request={deleteRequest} onConfirm={confirmDelete} onCancel={handleCancelDelete} />}
      <WorktreeDialogs />
      {gitConfirmation && <GitConfirmDialog confirmation={gitConfirmation} onConfirm={handleConfirmGit} onCancel={handleCancelGit} />}
      {closeConfirmation && <CloseConfirmDialog confirmation={closeConfirmation} onConfirm={confirmClose} onCancel={handleCancelClose} />}
      <PasteConfirmDialog />
      {unsavedPreview && <UnsavedPreviewDialog />}
      <McpConsentDialog />
      <Tooltip />
      <StatusBar />
    </div>
  )
}
