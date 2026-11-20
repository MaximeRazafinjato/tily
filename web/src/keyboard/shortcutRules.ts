import { chordKey, formatChord, hasAlt, hasCtrl, hasShift, isFunctionKey, isPrintableKey } from './keyChords'

export const MIN_LEADER_TIMEOUT_SECONDS = 1
export const MAX_LEADER_TIMEOUT_SECONDS = 60

const CLOSE_WINDOW = 'Alt+F4'
const CANCEL_LEADER_KEY = 'Escape'
const TAB_NUMBER = /^[1-9]$/

const RESERVED_DIRECT: Record<string, string> = {
  'Ctrl+C': 'interrompt le programme du terminal ou copie la sélection',
  'Ctrl+V': 'colle dans le terminal',
  'Ctrl+Shift+C': 'copie la sélection du terminal',
  'Ctrl+Shift+V': 'colle dans le terminal',
  [CLOSE_WINDOW]: 'ferme Tily',
  'Ctrl+Enter': 'insère un retour à la ligne dans un agent',
  'Shift+Enter': 'insère un retour à la ligne dans un agent',
}

const RESERVED_LEADER = new Set(['Ctrl+C', 'Ctrl+V', 'Ctrl+Shift+C', 'Ctrl+Shift+V', CLOSE_WINDOW])

export const directProblem = (chord: string): string | null => {
  const shown = formatChord(chord)
  const role = RESERVED_DIRECT[chord]
  if (role) {
    return `${shown} est réservé : il ${role}.`
  }
  const key = chordKey(chord)
  const ctrl = hasCtrl(chord)
  const alt = hasAlt(chord)
  const shift = hasShift(chord)
  return !ctrl && !alt && !isFunctionKey(key) && (!shift || isPrintableKey(key))
    ? `${shown} n’est pas utilisable : un raccourci direct passe par Ctrl ou Alt, sauf touche de fonction (F1 à F24) ou Maj+touche non imprimable.`
    : null
}

export const leaderChordProblem = (chord: string): string | null =>
  RESERVED_LEADER.has(chord) ? `${formatChord(chord)} ne peut pas servir de touche Leader : il ${RESERVED_DIRECT[chord]}.` : null

export const leaderKeyProblem = (key: string): string | null => {
  if (hasCtrl(key) || hasAlt(key)) {
    return `${formatChord(key)} n’est pas utilisable après le Leader : une touche seule, avec Maj au besoin.`
  }
  if (key === CANCEL_LEADER_KEY) {
    return 'Échap après le Leader est réservé : il annule le Leader.'
  }
  return TAB_NUMBER.test(key) ? `${key} après le Leader est réservé : il affiche l’onglet ${key}.` : null
}
