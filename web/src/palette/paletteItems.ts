import { longestWaitingFirst, waitedFor, waitingPanes } from '../agents/agentSummary'
import { bridge } from '../bridge/bridge'
import type { GitContext, ShellProfile } from '../bridge/messages'
import { Command, revealWorkspacePanel, runCommand } from '../keyboard/shortcuts'
import { DEFAULT_FONT_SIZE, MAX_FONT_SIZE, MIN_FONT_SIZE } from '../model/appearance'
import { activePane, activeTab, activeWorkspace, distinctWorkspaceName, FAVORITES_MAX, folderName, isLeaf, panesOf, RightPanelView, type Pane, type Session, type Tab, type Workspace } from '../model/session'
import { openPanelView } from '../panel/rightPanel'
import { refreshFolders } from '../explorer/fileExplorerActions'
import { openFilePicker } from '../explorer/projectFileActions'
import { refreshRepository } from '../git/gitRequests'
import { canSearchCommits, openCommitPicker } from '../git/commitSearch'
import { useAgentStore } from '../store/agentStore'
import { useExplorerStore } from '../store/explorerStore'
import { useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { RenameOrigin, useUiStore } from '../store/uiStore'
import { closeOtherTabsKeepingText, closeTabKeepingText, closeTabsToRightKeepingText, closeWorkspaceKeepingText, duplicateTabKeepingLayout, movePaneToTab, restoreClosedTab, restoreClosedTabAt } from '../terminal/tabLifecycle'
import { clearPaneScrollback, copyLastCommandOutput, joinPane } from '../terminal/terminalActions'
import { terminalRegistry } from '../terminal/terminalRegistry'
import { OpenTarget } from '../bridge/messages'
import { copyPaneBranch, copyPanePath, openPaneFolder } from '../terminal/contextActions'
import { WorktreePickerKind } from '../store/worktreeStore'
import { openWorktreePicker, requestWorktreeRemoval } from '../worktree/worktreeActions'
import { worktreeTarget } from '../worktree/worktreePaths'
import type { SearchItem } from './searchFilter'

enum PaletteKind {
  Command = 'command',
  Attention = 'attention',
  Workspace = 'workspace',
  Tab = 'tab',
  Pane = 'pane',
}

export interface PaletteItem extends SearchItem {
  kind: PaletteKind
  run: () => void
}

const SEPARATOR = ' · '
const FAVORITES_FULL_NOTICE = `Pas plus de ${FAVORITES_MAX} favoris : retirez une étoile avant d’en ajouter une.`
const ATTENTION_PREFIX = 'attention-'
const MOVE_TAB_PREFIX = 'move-tab-'
const JOIN_TAB_PREFIX = 'join-tab-'

const requestFontSize = (fontSize: number): void => bridge.send({ type: 'appearance.fontSize', fontSize })

const fontSizeItems = (): PaletteItem[] => {
  const size = terminalRegistry.fontSize()
  return [
    ...(size < MAX_FONT_SIZE ? [command('font-larger', `Agrandir le texte des terminaux (${size + 1} px)`, () => requestFontSize(size + 1))] : []),
    ...(size > MIN_FONT_SIZE ? [command('font-smaller', `Réduire le texte des terminaux (${size - 1} px)`, () => requestFontSize(size - 1))] : []),
    ...(size !== DEFAULT_FONT_SIZE ? [command('font-default', `Taille du texte des terminaux par défaut (${DEFAULT_FONT_SIZE} px)`, () => requestFontSize(DEFAULT_FONT_SIZE))] : []),
  ]
}

const showAndRun = (view: RightPanelView, run: () => void): void => {
  openPanelView(view)
  run()
}

const command = (id: string, label: string, run: () => void, hint?: string): PaletteItem => ({ id, kind: PaletteKind.Command, label, hint, favorite: false, run })

const commandItems = (session: Session, shells: ShellProfile[]): PaletteItem[] => {
  const store = useSessionStore.getState()
  const ui = useUiStore.getState()
  const workspace = activeWorkspace(session)
  const tab = workspace ? activeTab(workspace) : undefined
  const items: PaletteItem[] = [
    command('new-tab', 'Nouvel onglet', () => runCommand(Command.NewTab), 'Ctrl + Maj + T'),
    ...shells.map((shell) => command(`new-tab-${shell.id}`, `Nouvel onglet${SEPARATOR}${shell.name}`, () => store.newTab(shell.id))),
    command('split-x', 'Split côte à côte', () => runCommand(Command.SplitSideBySide), 'Ctrl + Maj + D'),
    command('split-y', 'Split haut / bas', () => runCommand(Command.SplitTopBottom), 'Ctrl + Maj + H'),
    command('close-pane', 'Fermer le pane actif', () => runCommand(Command.ClosePane), 'Ctrl + Maj + X'),
    command('toggle-zoom', 'Agrandir / réduire le pane actif', () => runCommand(Command.TogglePaneZoom), 'Ctrl + Maj + M'),
    command('join-waiting', 'Rejoindre l’agent en attente suivant', () => runCommand(Command.JoinWaitingAgent), 'Ctrl + Maj + A'),
    command('next-tab', 'Onglet suivant', () => runCommand(Command.NextTab), 'Ctrl + Tab'),
    command('previous-tab', 'Onglet précédent', () => runCommand(Command.PreviousTab), 'Ctrl + Maj + Tab'),
    command('new-workspace', 'Nouveau workspace', () => runCommand(Command.NewWorkspace), 'Ctrl + Maj + W'),
    command('new-window', 'Nouvelle fenêtre', () => bridge.send({ type: 'window.new' })),
    command('projects', 'Ouvrir un projet', () => runCommand(Command.Projects), 'Leader puis F'),
    command('create-worktree', 'Créer un worktree…', () => runCommand(Command.CreateWorktree), 'Leader puis N'),
    command('open-worktree', 'Ouvrir un worktree…', () => openWorktreePicker(WorktreePickerKind.Open)),
    command('toggle-explorer', 'Afficher / masquer les fichiers', () => runCommand(Command.ToggleExplorer), 'Ctrl + Maj + E'),
    command('toggle-git', 'Afficher / masquer Git', () => runCommand(Command.ToggleGit), 'Ctrl + Maj + G'),
    command('toggle-notes', 'Afficher / masquer les notes du workspace', () => runCommand(Command.ToggleNotes), 'Ctrl + Maj + O'),
    command('toggle-status-log', 'Afficher / masquer le journal des messages', () => runCommand(Command.ToggleStatusLog), 'Ctrl + Maj + L'),
    command('settings', 'Paramètres', () => runCommand(Command.Settings), 'Leader puis ,'),
    command('settings-export', 'Exporter les préférences…', () => {
      runCommand(Command.Settings)
      bridge.send({ type: 'settings.export' })
    }),
    command('settings-import', 'Importer les préférences…', () => {
      runCommand(Command.Settings)
      bridge.send({ type: 'settings.import' })
    }),
    command('restore-tab', 'Rouvrir le dernier onglet fermé', restoreClosedTab, 'Ctrl + Maj + Z'),
    command('toggle-sidebar', session.sidebarCollapsed ? 'Afficher les workspaces' : 'Masquer les workspaces', () => runCommand(Command.ToggleSidebar), 'Ctrl + Maj + B'),
    command('focus-sidebar', 'Aller au panneau des workspaces', revealWorkspacePanel),
  ]
  if (workspace) {
    items.push(
      command('rename-workspace', 'Renommer le workspace', () => ui.startRenamingWorkspace(workspace.id, RenameOrigin.Header)),
      command('move-workspace-up', 'Monter le workspace', () => store.moveWorkspace(workspace.id, -1)),
      command('move-workspace-down', 'Descendre le workspace', () => store.moveWorkspace(workspace.id, 1)),
      command('close-workspace', `Fermer le workspace${SEPARATOR}${workspace.name}`, () => closeWorkspaceKeepingText(workspace.id)),
    )
  }
  if (tab) {
    const paneId = tab.active
    items.push(
      command('copy-path', 'Copier le chemin du pane actif', () => copyPanePath(paneId)),
      command('previous-command', 'Remonter à la commande précédente du pane actif', () => runCommand(Command.PreviousCommand), 'Alt + PgUp'),
      command('next-command', 'Descendre à la commande suivante du pane actif', () => runCommand(Command.NextCommand), 'Alt + PgDn'),
      command('copy-last-output', 'Copier la sortie de la dernière commande du pane actif', () => copyLastCommandOutput(paneId)),
      command('clear-scrollback', 'Effacer l’historique de défilement du pane actif', () => clearPaneScrollback(paneId)),
      command('open-file', 'Ouvrir un fichier du projet…', openFilePicker),
      command('open-editor', 'Ouvrir le dossier du pane actif dans l’éditeur', () => openPaneFolder(paneId, OpenTarget.Editor)),
      command('open-explorer', 'Ouvrir le dossier du pane actif dans l’explorateur', () => openPaneFolder(paneId, OpenTarget.Explorer)),
      command('copy-branch', 'Copier la branche Git du pane actif', () => copyPaneBranch(paneId)),
      command('collapse-files', 'Tout replier dans l’arbre des fichiers', () => useExplorerStore.getState().collapseUnder(activePane(tab).path)),
      ...fontSizeItems(),
      command('refresh-files', 'Actualiser l’arbre des fichiers', () => showAndRun(RightPanelView.Files, refreshFolders), 'F5 dans l’arbre'),
      ...(canSearchCommits() ? [command('search-commit', 'Rechercher un commit dans le graphe…', openCommitPicker)] : []),
      command('refresh-git', 'Actualiser la vue Git', () => showAndRun(RightPanelView.Git, refreshRepository), 'F5 dans la vue Git'),
    )
    const context = useHostStore.getState().contexts[paneId]
    if (context?.worktreeRoot) {
      const { path, name } = worktreeTarget(context.worktreeRoot)
      items.push(command('remove-worktree', `Supprimer ce worktree${SEPARATOR}${name}…`, () => requestWorktreeRemoval(path, context.branch ?? undefined)))
    }
    if (!isLeaf(tab.tree)) {
      items.push(
        command('equalize-panes', 'Égaliser les panes de l’onglet', () => runCommand(Command.EqualizePanes), 'Leader puis ='),
        command('swap-pane-left', 'Échanger le pane actif avec son voisin de gauche', () => runCommand(Command.SwapPaneLeft), 'Leader puis Maj + ←'),
        command('swap-pane-right', 'Échanger le pane actif avec son voisin de droite', () => runCommand(Command.SwapPaneRight), 'Leader puis Maj + →'),
        command('swap-pane-up', 'Échanger le pane actif avec son voisin du haut', () => runCommand(Command.SwapPaneUp), 'Leader puis Maj + ↑'),
        command('swap-pane-down', 'Échanger le pane actif avec son voisin du bas', () => runCommand(Command.SwapPaneDown), 'Leader puis Maj + ↓'),
        command('move-pane-to-new-tab', 'Déplacer le pane actif dans un nouvel onglet', () => runCommand(Command.MovePaneToNewTab), 'Leader puis !'),
      )
    }
    items.push(
      command('rename-tab', 'Renommer l’onglet', () => ui.startRenamingTab(tab.id)),
      command('duplicate-tab', 'Dupliquer l’onglet', () => duplicateTabKeepingLayout(tab.id)),
      command('close-tab', 'Fermer l’onglet', () => closeTabKeepingText(tab.id)),
    )
    if (tab.manual) {
      items.push(command('auto-name-tab', 'Reprendre le nom du dossier pour l’onglet', () => useSessionStore.getState().resetTabName(tab.id)))
    }
    if (workspace && workspace.tabs.length > 1) {
      items.push(command('close-other-tabs', 'Fermer les autres onglets', () => closeOtherTabsKeepingText(tab.id)))
      if (workspace.tabs.at(-1)?.id !== tab.id) {
        items.push(command('close-tabs-to-right', 'Fermer les onglets à droite', () => closeTabsToRightKeepingText(tab.id)))
      }
    }
    for (const target of workspace?.tabs.filter((candidate) => candidate.id !== tab.id) ?? []) {
      items.push(command(`${JOIN_TAB_PREFIX}${target.id}`, `Déplacer le pane actif vers l’onglet${SEPARATOR}${target.name}`, () => movePaneToTab(paneId, target.id)))
    }
    for (const other of session.workspaces.filter((candidate) => candidate.id !== workspace?.id)) {
      for (const target of other.tabs) {
        items.push(command(`${JOIN_TAB_PREFIX}${target.id}`, `Déplacer le pane actif vers l’onglet${SEPARATOR}${other.name} / ${target.name}`, () => movePaneToTab(paneId, target.id)))
      }
    }
    for (const target of session.workspaces.filter((candidate) => candidate.id !== workspace?.id)) {
      items.push(command(`${MOVE_TAB_PREFIX}${target.id}`, `Déplacer l’onglet vers${SEPARATOR}${distinctWorkspaceName(session.workspaces, target)}`, () => store.moveTab(tab.id, target.id)))
    }
  }
  return items
}

const attentionItems = (session: Session): PaletteItem[] => {
  const { agents, since } = useAgentStore.getState()
  const now = Date.now()
  const waitingSince = (paneId: string): number => since[paneId] ?? now
  return longestWaitingFirst(waitingPanes(session, agents), since, now).map((pane) => ({
    id: `${ATTENTION_PREFIX}${pane.paneId}`,
    kind: PaletteKind.Attention,
    label: `Rejoindre${SEPARATOR}${pane.label}`,
    hint: `${waitedFor(now - waitingSince(pane.paneId))} · ${pane.detail}`,
    run: () => joinPane(pane.paneId),
  }))
}

const closedTabItems = (session: Session): PaletteItem[] =>
  session.closed
    .map((entry, position) => ({
      id: `closed-${position}-${entry.tab.id}`,
      kind: PaletteKind.Command,
      label: `Rouvrir l’onglet fermé${SEPARATOR}${entry.tab.name}`,
      hint: entry.workspaceName,
      run: () => restoreClosedTabAt(position),
    }))
    .reverse()

const paneHint = (pane: Pane, contexts: Record<string, GitContext>): string => {
  const branch = contexts[pane.id]?.branch
  return branch ? `${branch}${SEPARATOR}${pane.path}` : pane.path
}

const distinctTabName = (workspace: Workspace, tab: Tab): string =>
  workspace.tabs.some((other) => other !== tab && other.name === tab.name) ? `${tab.name} (onglet ${workspace.tabs.indexOf(tab) + 1})` : tab.name

const navigationItems = (session: Session): PaletteItem[] => {
  const { selectWorkspace, selectTab, selectPane } = useSessionStore.getState()
  const { contexts } = useHostStore.getState()
  return session.workspaces.flatMap((workspace) => [
    { id: `ws-${workspace.id}`, kind: PaletteKind.Workspace, label: `Workspace${SEPARATOR}${distinctWorkspaceName(session.workspaces, workspace)}`, run: () => selectWorkspace(workspace.id) },
    ...workspace.tabs.flatMap((tab) => [
      {
        id: `tab-${tab.id}`,
        kind: PaletteKind.Tab,
        label: `Onglet${SEPARATOR}${workspace.name} / ${distinctTabName(workspace, tab)}`,
        run: () => {
          selectWorkspace(workspace.id)
          selectTab(tab.id)
        },
      },
      ...panesOf(tab.tree).map((pane, index, panes) => ({
        id: `pane-${pane.id}`,
        kind: PaletteKind.Pane,
        label: `Pane${SEPARATOR}${workspace.name} / ${distinctTabName(workspace, tab)} / ${folderName(pane.path)} (${pane.shell})${panes.length > 1 ? `${SEPARATOR}${index + 1}/${panes.length}` : ''}`,
        hint: paneHint(pane, contexts),
        run: () => selectPane(pane.id),
      })),
    ]),
  ])
}

const isOrphanFavorite = (session: Session, commandId: string): boolean => {
  if (commandId.startsWith(ATTENTION_PREFIX)) {
    return true
  }
  if (commandId.startsWith(JOIN_TAB_PREFIX)) {
    const tabId = commandId.slice(JOIN_TAB_PREFIX.length)
    return !session.workspaces.some((workspace) => workspace.tabs.some((tab) => tab.id === tabId))
  }
  const workspaceId = commandId.startsWith(MOVE_TAB_PREFIX) ? commandId.slice(MOVE_TAB_PREFIX.length) : null
  return workspaceId !== null && !session.workspaces.some((workspace) => workspace.id === workspaceId) && !session.closed.some((entry) => entry.workspaceId === workspaceId)
}

export const toggleFavoriteCommand = (commandId: string): string | null => {
  const { session, toggleFavorite, setFavorites } = useSessionStore.getState()
  if (!session) {
    return null
  }
  const kept = session.favorites.filter((candidate) => !isOrphanFavorite(session, candidate))
  if (!kept.includes(commandId) && kept.length >= FAVORITES_MAX) {
    return FAVORITES_FULL_NOTICE
  }
  if (kept.length !== session.favorites.length) {
    setFavorites(kept)
  }
  toggleFavorite(commandId)
  return null
}

export const buildPaletteItems = (session: Session, shells: ShellProfile[]): PaletteItem[] => {
  const commands = commandItems(session, shells).map((item) => ({ ...item, favorite: session.favorites.includes(item.id) }))
  const favorites = commands.filter((item) => item.favorite)
  const others = commands.filter((item) => !item.favorite)
  return [...attentionItems(session), ...favorites, ...others, ...closedTabItems(session), ...navigationItems(session)]
}

