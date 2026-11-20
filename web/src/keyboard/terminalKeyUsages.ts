import { chordKey, formatChord, hasAlt, hasCtrl, hasShift, isLetterKey } from './keyChords'

enum TerminalProgram {
  Any = 'tous les programmes',
  PowerShell = 'PowerShell',
  ClaudeCode = 'Claude Code',
  Bash = 'bash',
  Fzf = 'fzf',
}

type TerminalKeyUsage = Partial<Record<TerminalProgram, string>>

const TERMINAL_KEY_USAGES: Record<string, TerminalKeyUsage> = {
  'Ctrl+A': { [TerminalProgram.PowerShell]: 'sélectionner toute la ligne', [TerminalProgram.ClaudeCode]: 'début de ligne', [TerminalProgram.Bash]: 'début de ligne' },
  'Ctrl+B': { [TerminalProgram.ClaudeCode]: 'passer la tâche en arrière-plan', [TerminalProgram.Bash]: 'caractère précédent' },
  'Ctrl+D': { [TerminalProgram.ClaudeCode]: 'quitter', [TerminalProgram.Bash]: 'quitter le shell' },
  'Ctrl+E': { [TerminalProgram.ClaudeCode]: 'fin de ligne', [TerminalProgram.Bash]: 'fin de ligne' },
  'Ctrl+F': { [TerminalProgram.Bash]: 'caractère suivant' },
  'Ctrl+G': { [TerminalProgram.ClaudeCode]: 'ouvrir la saisie dans l’éditeur' },
  'Ctrl+H': { [TerminalProgram.Any]: 'équivaut à Retour arrière' },
  'Ctrl+I': { [TerminalProgram.Any]: 'équivaut à Tab' },
  'Ctrl+J': { [TerminalProgram.ClaudeCode]: 'nouvelle ligne sans envoyer', [TerminalProgram.Bash]: 'valider la commande' },
  'Ctrl+K': { [TerminalProgram.ClaudeCode]: 'effacer jusqu’à la fin de ligne', [TerminalProgram.Bash]: 'effacer jusqu’à la fin de ligne' },
  'Ctrl+L': { [TerminalProgram.PowerShell]: 'effacer l’écran', [TerminalProgram.ClaudeCode]: 'redessiner l’écran', [TerminalProgram.Bash]: 'effacer l’écran' },
  'Ctrl+M': { [TerminalProgram.Any]: 'équivaut à Entrée' },
  'Ctrl+N': { [TerminalProgram.ClaudeCode]: 'élément suivant de l’historique', [TerminalProgram.Bash]: 'commande suivante' },
  'Ctrl+O': { [TerminalProgram.ClaudeCode]: 'afficher la transcription' },
  'Ctrl+P': { [TerminalProgram.ClaudeCode]: 'élément précédent de l’historique', [TerminalProgram.Bash]: 'commande précédente' },
  'Ctrl+R': {
    [TerminalProgram.PowerShell]: 'rechercher dans l’historique',
    [TerminalProgram.ClaudeCode]: 'rechercher dans l’historique',
    [TerminalProgram.Bash]: 'rechercher dans l’historique',
    [TerminalProgram.Fzf]: 'rechercher dans l’historique',
  },
  'Ctrl+S': { [TerminalProgram.PowerShell]: 'rechercher en avant dans l’historique', [TerminalProgram.ClaudeCode]: 'mettre la saisie de côté', [TerminalProgram.Bash]: 'rechercher en avant dans l’historique' },
  'Ctrl+T': { [TerminalProgram.ClaudeCode]: 'afficher la liste des tâches', [TerminalProgram.Bash]: 'inverser deux caractères', [TerminalProgram.Fzf]: 'rechercher un fichier' },
  'Ctrl+U': { [TerminalProgram.ClaudeCode]: 'effacer jusqu’au début de ligne', [TerminalProgram.Bash]: 'effacer jusqu’au début de ligne' },
  'Ctrl+W': { [TerminalProgram.PowerShell]: 'effacer le mot précédent', [TerminalProgram.ClaudeCode]: 'effacer le mot précédent', [TerminalProgram.Bash]: 'effacer le mot précédent' },
  'Ctrl+X': { [TerminalProgram.PowerShell]: 'couper', [TerminalProgram.ClaudeCode]: 'préfixe de raccourcis', [TerminalProgram.Bash]: 'préfixe de raccourcis' },
  'Ctrl+Y': { [TerminalProgram.PowerShell]: 'rétablir', [TerminalProgram.ClaudeCode]: 'coller le texte effacé', [TerminalProgram.Bash]: 'coller le texte effacé' },
  'Ctrl+Z': { [TerminalProgram.PowerShell]: 'annuler', [TerminalProgram.Bash]: 'suspendre le programme' },
  'Ctrl+Space': { [TerminalProgram.PowerShell]: 'complétion par menu' },
  'Ctrl+Backspace': { [TerminalProgram.PowerShell]: 'effacer le mot précédent', [TerminalProgram.ClaudeCode]: 'effacer le mot précédent' },
  'Ctrl+Delete': { [TerminalProgram.PowerShell]: 'effacer le mot suivant' },
  'Ctrl+Home': { [TerminalProgram.PowerShell]: 'effacer jusqu’au début de ligne', [TerminalProgram.ClaudeCode]: 'aller au début de la conversation' },
  'Ctrl+End': { [TerminalProgram.PowerShell]: 'effacer jusqu’à la fin de ligne', [TerminalProgram.ClaudeCode]: 'aller au dernier message' },
  'Ctrl+ArrowLeft': { [TerminalProgram.PowerShell]: 'mot précédent' },
  'Ctrl+ArrowRight': { [TerminalProgram.PowerShell]: 'mot suivant' },
  'Ctrl+ArrowUp': { [TerminalProgram.ClaudeCode]: 'parcourir les fichiers du diff' },
  'Ctrl+ArrowDown': { [TerminalProgram.ClaudeCode]: 'parcourir les fichiers du diff' },
  'Ctrl+PageUp': { [TerminalProgram.PowerShell]: 'faire défiler d’une ligne' },
  'Ctrl+PageDown': { [TerminalProgram.PowerShell]: 'faire défiler d’une ligne' },
  'Ctrl+Shift+ArrowLeft': { [TerminalProgram.PowerShell]: 'sélectionner le mot précédent' },
  'Ctrl+Shift+ArrowRight': { [TerminalProgram.PowerShell]: 'sélectionner le mot suivant' },
  'Shift+ArrowLeft': { [TerminalProgram.PowerShell]: 'sélectionner le caractère précédent', [TerminalProgram.ClaudeCode]: 'étendre la sélection' },
  'Shift+ArrowRight': { [TerminalProgram.PowerShell]: 'sélectionner le caractère suivant', [TerminalProgram.ClaudeCode]: 'étendre la sélection' },
  'Shift+ArrowUp': { [TerminalProgram.ClaudeCode]: 'étendre la sélection' },
  'Shift+ArrowDown': { [TerminalProgram.ClaudeCode]: 'étendre la sélection' },
  'Shift+Home': { [TerminalProgram.PowerShell]: 'sélectionner jusqu’au début de ligne', [TerminalProgram.ClaudeCode]: 'étendre la sélection' },
  'Shift+End': { [TerminalProgram.PowerShell]: 'sélectionner jusqu’à la fin de ligne', [TerminalProgram.ClaudeCode]: 'étendre la sélection' },
  'Shift+Tab': { [TerminalProgram.PowerShell]: 'complétion précédente', [TerminalProgram.ClaudeCode]: 'changer de mode de permission' },
  F3: { [TerminalProgram.PowerShell]: 'rechercher un caractère' },
  'Shift+F3': { [TerminalProgram.PowerShell]: 'rechercher un caractère en arrière' },
  F8: { [TerminalProgram.PowerShell]: 'rechercher le début de la saisie dans l’historique' },
  'Shift+F8': { [TerminalProgram.PowerShell]: 'rechercher le début de la saisie en avant dans l’historique' },
  'Alt+F7': { [TerminalProgram.PowerShell]: 'effacer l’historique' },
  'Alt+B': { [TerminalProgram.ClaudeCode]: 'mot précédent', [TerminalProgram.Bash]: 'mot précédent' },
  'Alt+C': { [TerminalProgram.Bash]: 'mettre une majuscule au mot', [TerminalProgram.Fzf]: 'aller dans un dossier' },
  'Alt+D': { [TerminalProgram.PowerShell]: 'effacer le mot suivant', [TerminalProgram.ClaudeCode]: 'effacer le mot suivant', [TerminalProgram.Bash]: 'effacer le mot suivant' },
  'Alt+F': { [TerminalProgram.ClaudeCode]: 'mot suivant', [TerminalProgram.Bash]: 'mot suivant' },
  'Alt+L': { [TerminalProgram.Bash]: 'mettre le mot en minuscules' },
  'Alt+M': { [TerminalProgram.ClaudeCode]: 'changer de mode de permission' },
  'Alt+O': { [TerminalProgram.ClaudeCode]: 'activer le mode rapide' },
  'Alt+P': { [TerminalProgram.ClaudeCode]: 'changer de modèle' },
  'Alt+T': { [TerminalProgram.ClaudeCode]: 'activer la réflexion étendue', [TerminalProgram.Bash]: 'inverser deux mots' },
  'Alt+U': { [TerminalProgram.Bash]: 'mettre le mot en majuscules' },
  'Alt+V': { [TerminalProgram.ClaudeCode]: 'coller une image' },
  'Alt+Y': { [TerminalProgram.ClaudeCode]: 'parcourir les textes effacés', [TerminalProgram.Bash]: 'parcourir les textes effacés' },
  'Alt+.': { [TerminalProgram.PowerShell]: 'reprendre le dernier argument', [TerminalProgram.Bash]: 'reprendre le dernier argument' },
}

const sendsToTerminal = (chord: string): boolean => (hasCtrl(chord) !== hasAlt(chord)) && !hasShift(chord) && isLetterKey(chordKey(chord))

const describeUsage = (usage: TerminalKeyUsage): string =>
  Object.entries(usage)
    .map(([program, action]) => `${program} (${action})`)
    .join(', ')

export const terminalKeyWarning = (chord: string): string | null => {
  const usage = TERMINAL_KEY_USAGES[chord]
  if (usage) {
    return `${formatChord(chord)} n’arrivera plus au terminal : ${describeUsage(usage)}.`
  }
  return sendsToTerminal(chord) ? `${formatChord(chord)} n’arrivera plus au terminal ni aux programmes des panes.` : null
}
