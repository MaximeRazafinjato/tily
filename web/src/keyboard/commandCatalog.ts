import { Command } from './commands'

export interface CommandEntry {
  command: Command
  label: string
  hint?: string
}

export interface CommandGroup {
  title: string
  entries: CommandEntry[]
}

export const COMMAND_GROUPS: CommandGroup[] = [
  {
    title: 'Général',
    entries: [
      { command: Command.Palette, label: 'Ouvrir la palette', hint: 'palette' },
      { command: Command.Settings, label: 'Paramètres', hint: 'paramètres' },
      { command: Command.AppearanceSettings, label: 'Couleur de Tily et palette du terminal…', hint: 'couleur de Tily' },
      { command: Command.Projects, label: 'Ouvrir un projet', hint: 'projet' },
      { command: Command.OpenFile, label: 'Ouvrir un fichier du projet…', hint: 'fichier du projet' },
      { command: Command.SearchTerminals, label: 'Rechercher dans tous les terminaux…', hint: 'rechercher partout' },
      { command: Command.FontLarger, label: 'Agrandir le texte des terminaux', hint: 'texte plus grand' },
      { command: Command.FontSmaller, label: 'Réduire le texte des terminaux', hint: 'texte plus petit' },
      { command: Command.FontDefault, label: 'Taille du texte des terminaux par défaut', hint: 'taille du texte par défaut' },
      { command: Command.SettingsExport, label: 'Exporter les préférences…', hint: 'exporter les préférences' },
      { command: Command.SettingsImport, label: 'Importer les préférences…', hint: 'importer les préférences' },
    ],
  },
  {
    title: 'Workspaces',
    entries: [
      { command: Command.NewWorkspace, label: 'Nouveau workspace', hint: 'workspace' },
      { command: Command.ToggleSidebar, label: 'Afficher / masquer les workspaces', hint: 'workspaces' },
      { command: Command.FocusSidebar, label: 'Aller au panneau des workspaces', hint: 'panneau des workspaces' },
      { command: Command.RenameWorkspace, label: 'Renommer le workspace', hint: 'renommer le workspace' },
      { command: Command.WorkspaceColor, label: 'Couleur du workspace ou du projet…', hint: 'couleur du workspace' },
      { command: Command.MoveWorkspaceUp, label: 'Monter le workspace', hint: 'monter le workspace' },
      { command: Command.MoveWorkspaceDown, label: 'Descendre le workspace', hint: 'descendre le workspace' },
      { command: Command.CloseWorkspace, label: 'Fermer le workspace', hint: 'fermer le workspace' },
    ],
  },
  {
    title: 'Onglets',
    entries: [
      { command: Command.NewTab, label: 'Nouvel onglet', hint: 'onglet' },
      { command: Command.NextTab, label: 'Onglet suivant', hint: 'onglet suivant' },
      { command: Command.PreviousTab, label: 'Onglet précédent', hint: 'onglet précédent' },
      { command: Command.MoveTabLeft, label: 'Déplacer l’onglet vers la gauche', hint: 'onglet vers la gauche' },
      { command: Command.MoveTabRight, label: 'Déplacer l’onglet vers la droite', hint: 'onglet vers la droite' },
      { command: Command.RestoreTab, label: 'Rouvrir le dernier onglet fermé', hint: 'rouvrir' },
      { command: Command.RenameTab, label: 'Renommer l’onglet', hint: 'renommer l’onglet' },
      { command: Command.AutoNameTab, label: 'Reprendre le nom du dossier pour l’onglet', hint: 'nom du dossier' },
      { command: Command.DuplicateTab, label: 'Dupliquer l’onglet', hint: 'dupliquer l’onglet' },
      { command: Command.TabColor, label: 'Couleur de l’onglet…', hint: 'couleur de l’onglet' },
      { command: Command.CloseTab, label: 'Fermer l’onglet', hint: 'fermer l’onglet' },
      { command: Command.CloseOtherTabs, label: 'Fermer les autres onglets', hint: 'fermer les autres onglets' },
      { command: Command.CloseTabsToRight, label: 'Fermer les onglets à droite', hint: 'fermer les onglets à droite' },
    ],
  },
  {
    title: 'Panes',
    entries: [
      { command: Command.SplitSideBySide, label: 'Split côte à côte', hint: 'côte à côte' },
      { command: Command.SplitTopBottom, label: 'Split haut / bas', hint: 'haut / bas' },
      { command: Command.ClosePane, label: 'Fermer le pane actif', hint: 'fermer le pane' },
      { command: Command.TogglePaneZoom, label: 'Agrandir / réduire le pane actif', hint: 'agrandir / réduire le pane' },
      { command: Command.EqualizePanes, label: 'Égaliser les panes de l’onglet', hint: 'égaliser les panes' },
      { command: Command.MovePaneToNewTab, label: 'Déplacer le pane actif dans un nouvel onglet', hint: 'pane dans un nouvel onglet' },
      { command: Command.FocusPaneLeft, label: 'Aller au pane de gauche', hint: 'pane de gauche' },
      { command: Command.FocusPaneRight, label: 'Aller au pane de droite', hint: 'pane de droite' },
      { command: Command.FocusPaneUp, label: 'Aller au pane du haut', hint: 'pane du haut' },
      { command: Command.FocusPaneDown, label: 'Aller au pane du bas', hint: 'pane du bas' },
      { command: Command.SwapPaneLeft, label: 'Échanger le pane actif avec son voisin de gauche', hint: 'échanger à gauche' },
      { command: Command.SwapPaneRight, label: 'Échanger le pane actif avec son voisin de droite', hint: 'échanger à droite' },
      { command: Command.SwapPaneUp, label: 'Échanger le pane actif avec son voisin du haut', hint: 'échanger en haut' },
      { command: Command.SwapPaneDown, label: 'Échanger le pane actif avec son voisin du bas', hint: 'échanger en bas' },
      { command: Command.JoinWaitingAgent, label: 'Rejoindre l’agent en attente suivant', hint: 'agent en attente' },
    ],
  },
  {
    title: 'Terminal du pane actif',
    entries: [
      { command: Command.PreviousCommand, label: 'Remonter à la commande précédente', hint: 'commande précédente' },
      { command: Command.NextCommand, label: 'Descendre à la commande suivante', hint: 'commande suivante' },
      { command: Command.SearchPane, label: 'Rechercher dans le terminal du pane actif…', hint: 'rechercher' },
      { command: Command.CopyPath, label: 'Copier le chemin du pane actif', hint: 'copier le chemin' },
      { command: Command.CopyBranch, label: 'Copier la branche Git du pane actif', hint: 'copier la branche' },
      { command: Command.CopyLastOutput, label: 'Copier la sortie de la dernière commande', hint: 'copier la dernière sortie' },
      { command: Command.ClearScrollback, label: 'Effacer l’historique de défilement', hint: 'effacer l’historique' },
      { command: Command.OpenEditor, label: 'Ouvrir le dossier du pane dans l’éditeur', hint: 'dossier dans l’éditeur' },
      { command: Command.OpenExplorer, label: 'Ouvrir le dossier du pane dans l’explorateur', hint: 'dossier dans l’explorateur' },
    ],
  },
  {
    title: 'Navigateur',
    entries: [
      { command: Command.OpenBrowser, label: 'Navigateur côte à côte', hint: 'navigateur' },
      { command: Command.BrowserBelow, label: 'Navigateur en dessous', hint: 'navigateur en dessous' },
      { command: Command.BrowserTab, label: 'Navigateur dans un nouvel onglet', hint: 'navigateur en onglet' },
    ],
  },
  {
    title: 'Panneaux, Git et worktrees',
    entries: [
      { command: Command.ToggleExplorer, label: 'Afficher / masquer les fichiers', hint: 'fichiers' },
      { command: Command.ToggleGit, label: 'Afficher / masquer Git', hint: 'git' },
      { command: Command.ToggleNotes, label: 'Afficher / masquer les notes du workspace', hint: 'notes' },
      { command: Command.ToggleStatusLog, label: 'Afficher / masquer le journal des messages', hint: 'journal' },
      { command: Command.CollapseFiles, label: 'Tout replier dans l’arbre des fichiers', hint: 'tout replier' },
      { command: Command.RefreshFiles, label: 'Actualiser l’arbre des fichiers', hint: 'actualiser les fichiers' },
      { command: Command.RefreshGit, label: 'Actualiser la vue Git', hint: 'actualiser Git' },
      { command: Command.SearchCommit, label: 'Rechercher un commit dans le graphe…', hint: 'rechercher un commit' },
      { command: Command.CreateWorktree, label: 'Créer un worktree…', hint: 'worktree' },
      { command: Command.OpenWorktree, label: 'Ouvrir un worktree…', hint: 'ouvrir un worktree' },
      { command: Command.RemoveWorktree, label: 'Supprimer le worktree du pane actif…', hint: 'supprimer le worktree' },
    ],
  },
]

export const COMMAND_ENTRIES: CommandEntry[] = COMMAND_GROUPS.flatMap((group) => group.entries)
