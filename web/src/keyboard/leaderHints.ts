import type { ShortcutSettings } from '../bridge/messages'
import { COMMAND_ENTRIES } from './commandCatalog'
import { formatChord } from './keyChords'

export interface LeaderHint {
  keys: string
  label: string
}

export const leaderHintsOf = (settings: ShortcutSettings): LeaderHint[] => [
  ...COMMAND_ENTRIES.flatMap(({ command, label, hint }) => {
    const key = settings.bindings[command]?.leader
    return key ? [{ keys: formatChord(key), label: hint ?? label }] : []
  }),
  { keys: '1 … 9', label: 'onglet n (9 : dernier)' },
  { keys: 'Échap', label: 'annuler' },
  { keys: formatChord(settings.leader), label: 'envoyer au terminal' },
]
