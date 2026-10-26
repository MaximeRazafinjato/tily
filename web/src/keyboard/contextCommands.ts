import { bridge } from '../bridge/bridge'
import { OpenTarget } from '../bridge/messages'
import { BrowserPlacement, openBrowser } from '../browser/browserActions'
import { refreshFolders } from '../explorer/fileExplorerActions'
import { openFilePicker } from '../explorer/projectFileActions'
import { canSearchCommits, openCommitPicker } from '../git/commitSearch'
import { refreshRepository } from '../git/gitRequests'
import { DEFAULT_FONT_SIZE, MAX_FONT_SIZE, MIN_FONT_SIZE } from '../model/appearance'
import { activePane, activeTab, activeWorkspace, RightPanelView, type Tab, type Workspace } from '../model/session'
import { openPanelView } from '../panel/rightPanel'
import { useExplorerStore } from '../store/explorerStore'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { RenameOrigin, useUiStore } from '../store/uiStore'
import { WorktreePickerKind } from '../store/worktreeStore'
import { copyPaneBranch, copyPanePath, openPaneFolder } from '../terminal/contextActions'
import { closeOtherTabsKeepingText, closeTabKeepingText, closeTabsToRightKeepingText, closeWorkspaceKeepingText, duplicateTabKeepingLayout } from '../terminal/tabLifecycle'
import { clearPaneScrollback, copyLastCommandOutput } from '../terminal/terminalActions'
import { terminalRegistry } from '../terminal/terminalRegistry'
import { openWorktreePicker, requestWorktreeRemoval } from '../worktree/worktreeActions'
import { worktreeTarget } from '../worktree/worktreePaths'
import { Command } from './commands'

const NO_WORKSPACE = 'Aucun workspace actif.'
const NO_TAB = 'Aucun onglet actif.'

const warn = (text: string): void => useHostStore.getState().setStatus(text, StatusLevel.Warning)

const currentWorkspace = (): Workspace | undefined => {
  const { session } = useSessionStore.getState()
  return session ? activeWorkspace(session) : undefined
}

const withWorkspace = (run: (workspace: Workspace) => void): void => {
  const workspace = currentWorkspace()
  if (workspace) {
    run(workspace)
  } else {
    warn(NO_WORKSPACE)
  }
}

const withTab = (run: (tab: Tab, workspace: Workspace) => void): void => {
  const workspace = currentWorkspace()
  if (workspace) {
    run(activeTab(workspace), workspace)
  } else {
    warn(NO_TAB)
  }
}

const requestFontSize = (fontSize: number, unchanged: string): void => {
  if (fontSize === terminalRegistry.fontSize()) {
    warn(unchanged)
  } else {
    bridge.send({ type: 'appearance.fontSize', fontSize })
  }
}

const removePaneWorktree = (tab: Tab): void => {
  const context = useHostStore.getState().contexts[tab.active]
  if (!context?.worktreeRoot) {
    warn('Le pane actif n’est pas dans un worktree.')
    return
  }
  requestWorktreeRemoval(worktreeTarget(context.worktreeRoot).path, context.branch ?? undefined)
}

const closeOtherTabs = (tab: Tab, workspace: Workspace): void => {
  if (workspace.tabs.length > 1) {
    closeOtherTabsKeepingText(tab.id)
  } else {
    warn('Aucun autre onglet dans ce workspace.')
  }
}

const closeTabsToRight = (tab: Tab, workspace: Workspace): void => {
  if (workspace.tabs.at(-1)?.id !== tab.id) {
    closeTabsToRightKeepingText(tab.id)
  } else {
    warn('Aucun onglet à droite de l’onglet actif.')
  }
}

const autoNameTab = (tab: Tab): void => {
  if (tab.manual) {
    useSessionStore.getState().resetTabName(tab.id)
  } else {
    warn('L’onglet porte déjà le nom de son dossier.')
  }
}

const searchCommit = (): void => {
  if (canSearchCommits()) {
    openCommitPicker()
  } else {
    warn('Aucun graphe Git chargé : ouvrez la vue Git d’un dépôt.')
  }
}

export const runContextCommand = (command: Command): void => {
  switch (command) {
    case Command.BrowserBelow:
      openBrowser(BrowserPlacement.Below)
      break
    case Command.BrowserTab:
      openBrowser(BrowserPlacement.Tab)
      break
    case Command.OpenWorktree:
      openWorktreePicker(WorktreePickerKind.Open)
      break
    case Command.RemoveWorktree:
      withTab(removePaneWorktree)
      break
    case Command.OpenFile:
      withTab(openFilePicker)
      break
    case Command.SearchCommit:
      searchCommit()
      break
    case Command.RenameWorkspace:
      withWorkspace((workspace) => useUiStore.getState().startRenamingWorkspace(workspace.id, RenameOrigin.Header))
      break
    case Command.MoveWorkspaceUp:
      withWorkspace((workspace) => useSessionStore.getState().moveWorkspace(workspace.id, -1))
      break
    case Command.MoveWorkspaceDown:
      withWorkspace((workspace) => useSessionStore.getState().moveWorkspace(workspace.id, 1))
      break
    case Command.CloseWorkspace:
      withWorkspace((workspace) => closeWorkspaceKeepingText(workspace.id))
      break
    case Command.RenameTab:
      withTab((tab) => useUiStore.getState().startRenamingTab(tab.id))
      break
    case Command.AutoNameTab:
      withTab(autoNameTab)
      break
    case Command.DuplicateTab:
      withTab((tab) => duplicateTabKeepingLayout(tab.id))
      break
    case Command.CloseTab:
      withTab((tab) => closeTabKeepingText(tab.id))
      break
    case Command.CloseOtherTabs:
      withTab(closeOtherTabs)
      break
    case Command.CloseTabsToRight:
      withTab(closeTabsToRight)
      break
    case Command.CopyPath:
      withTab((tab) => copyPanePath(tab.active))
      break
    case Command.CopyBranch:
      withTab((tab) => copyPaneBranch(tab.active))
      break
    case Command.CopyLastOutput:
      withTab((tab) => copyLastCommandOutput(tab.active))
      break
    case Command.ClearScrollback:
      withTab((tab) => clearPaneScrollback(tab.active))
      break
    case Command.OpenEditor:
      withTab((tab) => openPaneFolder(tab.active, OpenTarget.Editor))
      break
    case Command.OpenExplorer:
      withTab((tab) => openPaneFolder(tab.active, OpenTarget.Explorer))
      break
    case Command.CollapseFiles:
      withTab((tab) => useExplorerStore.getState().collapseUnder(activePane(tab).path))
      break
    case Command.RefreshFiles:
      withTab(() => {
        openPanelView(RightPanelView.Files)
        refreshFolders()
      })
      break
    case Command.RefreshGit:
      withTab(() => {
        openPanelView(RightPanelView.Git)
        refreshRepository()
      })
      break
    case Command.FontLarger:
      requestFontSize(Math.min(terminalRegistry.fontSize() + 1, MAX_FONT_SIZE), `Le texte des terminaux est déjà à sa taille maximale (${MAX_FONT_SIZE} px).`)
      break
    case Command.FontSmaller:
      requestFontSize(Math.max(terminalRegistry.fontSize() - 1, MIN_FONT_SIZE), `Le texte des terminaux est déjà à sa taille minimale (${MIN_FONT_SIZE} px).`)
      break
    case Command.FontDefault:
      requestFontSize(DEFAULT_FONT_SIZE, `Le texte des terminaux est déjà à sa taille par défaut (${DEFAULT_FONT_SIZE} px).`)
      break
  }
}
