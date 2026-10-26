const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'AltGraph', 'Meta'])
const CTRL = 'Ctrl'
const ALT = 'Alt'
const SHIFT = 'Shift'
const PLUS = 'Plus'
const SPACE = 'Space'
const SEPARATOR = '+'
const PRINTABLE_ASCII = /^[!-~]$/
const LETTER = /^[A-Z]$/
const FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/
const CODE_LETTER = /^Key([A-Z])$/
const CODE_DIGIT = /^Digit(\d)$/

const DISPLAY_NAMES: Record<string, string> = {
  [SHIFT]: 'Maj',
  [SPACE]: 'Espace',
  Enter: 'Entrée',
  Escape: 'Échap',
  Backspace: 'Retour arrière',
  Delete: 'Suppr',
  Insert: 'Inser',
  Home: 'Début',
  End: 'Fin',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  [PLUS]: '+',
}

export const isModifierKey = (event: KeyboardEvent): boolean => MODIFIER_KEYS.has(event.key)

const keyOf = (event: KeyboardEvent): string | null => {
  const { key, code } = event
  if (MODIFIER_KEYS.has(key)) {
    return null
  }
  if (key === ' ' || code === 'Space') {
    return SPACE
  }
  if (key === '+') {
    return PLUS
  }
  if (PRINTABLE_ASCII.test(key)) {
    return key.toUpperCase()
  }
  const letter = CODE_LETTER.exec(code)?.[1] ?? CODE_DIGIT.exec(code)?.[1]
  if (letter) {
    return letter
  }
  return key.length === 1 ? key.toUpperCase() : key
}

export const isLetterKey = (key: string): boolean => LETTER.test(key)

export const isCharacterKey = (key: string): boolean => (key.length === 1 && !isLetterKey(key)) || key === PLUS

export const isPrintableKey = (key: string): boolean => key.length === 1 || key === PLUS || key === SPACE

export const isFunctionKey = (key: string): boolean => FUNCTION_KEY.test(key)

export const chordKey = (chord: string): string => chord.slice(chord.lastIndexOf(SEPARATOR) + 1)

export const chordHas = (chord: string, modifier: string): boolean => chord.split(SEPARATOR).slice(0, -1).includes(modifier)

export const hasCtrl = (chord: string): boolean => chordHas(chord, CTRL)

export const hasAlt = (chord: string): boolean => chordHas(chord, ALT)

export const hasShift = (chord: string): boolean => chordHas(chord, SHIFT)

export const chordOf = (event: KeyboardEvent): string | null => {
  const key = keyOf(event)
  if (!key) {
    return null
  }
  const parts = [event.ctrlKey && CTRL, event.altKey && ALT, event.shiftKey && !isCharacterKey(key) && SHIFT, key]
  return parts.filter(Boolean).join(SEPARATOR)
}

export const leaderKeyOf = (event: KeyboardEvent): string | null => {
  const key = keyOf(event)
  if (!key) {
    return null
  }
  return event.shiftKey && !isCharacterKey(key) && !isLetterKey(key) ? `${SHIFT}${SEPARATOR}${key}` : key
}

export const formatChord = (chord: string): string =>
  chord
    .split(SEPARATOR)
    .map((part) => DISPLAY_NAMES[part] ?? part)
    .join('+')
