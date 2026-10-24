import { longestWaitingFirst, waitedFor, waitingPanes } from '../agents/agentSummary'
import type { GitContext, ShellProfile } from '../bridge/messages'
import { shortcutText } from '../keyboard/shortcutLabels'
import { Command, runCommand } from '../keyboard/shortcuts'
import { DEFAULT_FONT_SIZE, MAX_FONT_SIZE, MIN_FONT_SIZE } from '../model/appearance'
import { activeTab, activeWorkspace, distinctWorkspaceName, FAVORITES_MAX, folderName, isLeaf, panesOf, type Pane, type Session, type Tab, type Workspace } from '../model/session'
import { canSearchCommits } from '../git/commitSearch'
import { canEditMergeRequest, createMergeRequestLabel, editMergeRequestLabel, openMergeRequestEditForm, openMergeRequestForm } from '../forge/mergeRequestFormActions'
import { branchKey, useForgeStore } from '../store/forgeStore'
import { useAgentStore } from '../store/agentStore'
import { useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { movePaneToTab, restoreClosedTabAt } from '../terminal/tabLifecycle'
import { joinPane } from '../terminal/terminalActions'
import { terminalRegistry } from '../terminal/terminalRegistry'
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

const fontSizeItems = (): PaletteItem[] => {
  const size = terminalRegistry.fontSize()
  return [
    ...(size < MAX_FONT_SIZE ? [bound('font-larger', `Agrandir le texte des terminaux (${size + 1} px)`, Command.FontLarger)] : []),
    ...(size > MIN_FONT_SIZE ? [bound('font-smaller', `Réduire le texte des terminaux (${size - 1} px)`, Command.FontSmaller)] : []),
    ...(size !== DEFAULT_FONT_SIZE ? [bound('font-default', `Taille du texte des terminaux par défaut (${DEFAULT_FONT_SIZE} px)`, Command.FontDefault)] : []),
  ]
}

const command = (id: string, label: string, run: () => void, hint?: string): PaletteItem => ({ id, kind: PaletteKind.Command, label, hint, favorite: false, run })

const bound = (id: string, label: string, target: Command, fallbackHint?: string): PaletteItem => command(id, label, () => runCommand(target), shortcutText(target) ?? fallbackHint)

const commandItems = (session: Session, shells: ShellProfile[]): PaletteItem[] => {
  const store = useSessionStore.getState()
  const workspace = activeWorkspace(session)
  const tab = workspace ? activeTab(workspace) : undefined
  const items: PaletteItem[] = [
    bound('new-tab', 'Nouvel onglet', Command.NewTab),
    ...shells.map((shell) => command(`new-tab-${shell.id}`, `Nouvel onglet${SEPARATOR}${shell.name}`, () => store.newTab(shell.id))),
    bound('split-x', 'Split côte à côte', Command.SplitSideBySide),
    bound('split-y', 'Split haut / bas', Command.SplitTopBottom),
    bound('browser-beside', 'Navigateur côte à côte', Command.OpenBrowser),
    bound('browser-below', 'Navigateur en dessous', Command.BrowserBelow),
    bound('browser-tab', 'Navigateur dans un nouvel onglet', Command.BrowserTab),
    bound('close-pane', 'Fermer le pane actif', Command.ClosePane),
    bound('toggle-zoom', 'Agrandir / réduire le pane actif', Command.TogglePaneZoom),
    bound('join-waiting', 'Rejoindre l’agent en attente suivant', Command.JoinWaitingAgent),
    bound('next-tab', 'Onglet suivant', Command.NextTab),
    bound('previous-tab', 'Onglet précédent', Command.PreviousTab),
    bound('new-workspace', 'Nouveau workspace', Command.NewWorkspace),
    bound('projects', 'Ouvrir un projet', Command.Projects),
    bound('create-worktree', 'Créer un worktree…', Command.CreateWorktree),
    bound('open-worktree', 'Ouvrir un worktree…', Command.OpenWorktree),
    bound('toggle-explorer', 'Afficher / masquer les fichiers', Command.ToggleExplorer),
    bound('toggle-git', 'Afficher / masquer Git', Command.ToggleGit),
    bound('toggle-notes', 'Afficher / masquer les notes du workspace', Command.ToggleNotes),
    bound('toggle-status-log', 'Afficher / masquer le journal des messages', Command.ToggleStatusLog),
    bound('settings', 'Paramètres', Command.Settings),
    bound('settings-export', 'Exporter les préférences…', Command.SettingsExport),
    bound('settings-import', 'Importer les préférences…', Command.SettingsImport),
    bound('search-terminals', 'Rechercher dans tous les terminaux…', Command.SearchTerminals, 'Alt + Entrée dans la recherche'),
    bound('restore-tab', 'Rouvrir le dernier onglet fermé', Command.RestoreTab),
    bound('toggle-sidebar', session.sidebarCollapsed ? 'Afficher les workspaces' : 'Masquer les workspaces', Command.ToggleSidebar),
    bound('focus-sidebar', 'Aller au panneau des workspaces', Command.FocusSidebar),
  ]
  if (workspace) {
    items.push(
      bound('rename-workspace', 'Renommer le workspace', Command.RenameWorkspace),
      bound('move-workspace-up', 'Monter le workspace', Command.MoveWorkspaceUp),
      bound('move-workspace-down', 'Descendre le workspace', Command.MoveWorkspaceDown),
      bound('close-workspace', `Fermer le workspace${SEPARATOR}${workspace.name}`, Command.CloseWorkspace),
    )
  }
  if (tab) {
    const paneId = tab.active
    items.push(
      bound('copy-path', 'Copier le chemin du pane actif', Command.CopyPath),
      bound('previous-command', 'Remonter à la commande précédente du pane actif', Command.PreviousCommand),
      bound('next-command', 'Descendre à la commande suivante du pane actif', Command.NextCommand),
      bound('search-pane', 'Rechercher dans le terminal du pane actif…', Command.SearchPane),
      bound('copy-last-output', 'Copier la sortie de la dernière commande du pane actif', Command.CopyLastOutput),
      bound('clear-scrollback', 'Effacer l’historique de défilement du pane actif', Command.ClearScrollback),
      bound('open-file', 'Ouvrir un fichier du projet…', Command.OpenFile),
      bound('open-editor', 'Ouvrir le dossier du pane actif dans l’éditeur', Command.OpenEditor),
      bound('open-explorer', 'Ouvrir le dossier du pane actif dans l’explorateur', Command.OpenExplorer),
      bound('copy-branch', 'Copier la branche Git du pane actif', Command.CopyBranch),
      bound('collapse-files', 'Tout replier dans l’arbre des fichiers', Command.CollapseFiles),
      ...fontSizeItems(),
      bound('refresh-files', 'Actualiser l’arbre des fichiers', Command.RefreshFiles, 'F5 dans l’arbre'),
      ...(canSearchCommits() ? [bound('search-commit', 'Rechercher un commit dans le graphe…', Command.SearchCommit)] : []),
      bound('refresh-git', 'Actualiser la vue Git', Command.RefreshGit, 'F5 dans la vue Git'),
    )
    const context = useHostStore.getState().contexts[paneId]
    const pane = panesOf(tab.tree).find((candidate) => candidate.id === paneId)
    if (pane && context?.branch) {
      const { branch } = context
      items.push(command('create-merge-request', `${createMergeRequestLabel(pane.path, branch)}…`, () => openMergeRequestForm(pane.path, branch), `depuis ${branch}`))
      const branchResult = useForgeStore.getState().branches[branchKey(pane.path, branch)]
      branchResult?.items
        .filter(canEditMergeRequest)
        .forEach((item) => items.push(command(`edit-merge-request-${item.number}`, editMergeRequestLabel(item, branchResult.forge?.kind), () => openMergeRequestEditForm(pane.path, item), item.title)))
    }
    if (context?.worktreeRoot) {
      items.push(bound('remove-worktree', `Supprimer ce worktree${SEPARATOR}${worktreeTarget(context.worktreeRoot).name}…`, Command.RemoveWorktree))
    }
    if (!isLeaf(tab.tree)) {
      items.push(
        bound('equalize-panes', 'Égaliser les panes de l’onglet', Command.EqualizePanes),
        bound('swap-pane-left', 'Échanger le pane actif avec son voisin de gauche', Command.SwapPaneLeft),
        bound('swap-pane-right', 'Échanger le pane actif avec son voisin de droite', Command.SwapPaneRight),
        bound('swap-pane-up', 'Échanger le pane actif avec son voisin du haut', Command.SwapPaneUp),
        bound('swap-pane-down', 'Échanger le pane actif avec son voisin du bas', Command.SwapPaneDown),
        bound('move-pane-to-new-tab', 'Déplacer le pane actif dans un nouvel onglet', Command.MovePaneToNewTab),
      )
    }
    items.push(
      bound('rename-tab', 'Renommer l’onglet', Command.RenameTab),
      bound('duplicate-tab', 'Dupliquer l’onglet', Command.DuplicateTab),
      bound('close-tab', 'Fermer l’onglet', Command.CloseTab),
    )
    if (tab.manual) {
      items.push(bound('auto-name-tab', 'Reprendre le nom du dossier pour l’onglet', Command.AutoNameTab))
    }
    if (workspace && workspace.tabs.length > 1) {
      items.push(bound('close-other-tabs', 'Fermer les autres onglets', Command.CloseOtherTabs))
      if (workspace.tabs.at(-1)?.id !== tab.id) {
        items.push(bound('close-tabs-to-right', 'Fermer les onglets à droite', Command.CloseTabsToRight))
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

