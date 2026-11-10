import type { ShortcutBinding, ShortcutSettings } from '../bridge/messages'
import { ShortcutField } from '../store/shortcutStore'
import { COMMAND_ENTRIES } from './commandCatalog'
import type { Command } from './commands'
import { formatChord } from './keyChords'
import { directProblem, leaderChordProblem, leaderKeyProblem } from './shortcutRules'
import { terminalKeyWarning } from './terminalKeyUsages'

export interface ShortcutFeedback {
  notice: string | null
  error: string | null
}

export interface ShortcutChange extends ShortcutFeedback {
  shortcuts: ShortcutSettings
}

const EMPTY_BINDING: ShortcutBinding = { direct: '', leader: '' }
const LEADER_TWICE = 'Le Leader deux fois de suite l’envoie quand même au terminal.'

const joinNotices = (notices: (string | null)[]): string | null => {
  const shown = notices.filter(Boolean)
  return shown.length > 0 ? shown.join(' ') : null
}

const leaderWarning = (chord: string): string | null => {
  const warning = terminalKeyWarning(chord)
  return warning ? `${warning} ${LEADER_TWICE}` : null
}

const labelOf = (command: string): string => COMMAND_ENTRIES.find((entry) => entry.command === command)?.label ?? command

const bindingOf = (shortcuts: ShortcutSettings, command: string): ShortcutBinding => shortcuts.bindings[command] ?? EMPTY_BINDING

const withBinding = (shortcuts: ShortcutSettings, command: string, patch: Partial<ShortcutBinding>): ShortcutSettings => ({
  ...shortcuts,
  bindings: { ...shortcuts.bindings, [command]: { ...bindingOf(shortcuts, command), ...patch } },
})

const ownerOf = (shortcuts: ShortcutSettings, field: ShortcutField, chord: string, except: string): string | undefined =>
  Object.keys(shortcuts.bindings).find((command) => command !== except && shortcuts.bindings[command][field] === chord)

const problemOf = (field: ShortcutField, chord: string): string | null => (field === ShortcutField.Direct ? directProblem(chord) : leaderKeyProblem(chord))

const unchanged = (shortcuts: ShortcutSettings, error: string): ShortcutChange => ({ shortcuts, notice: null, error })

export const assignShortcut = (shortcuts: ShortcutSettings, command: Command, field: ShortcutField, chord: string): ShortcutChange => {
  if (chord.length === 0) {
    return { shortcuts: withBinding(shortcuts, command, { [field]: '' }), notice: null, error: null }
  }
  const problem = problemOf(field, chord)
  if (problem) {
    return unchanged(shortcuts, problem)
  }
  if (chord === shortcuts.leader) {
    return unchanged(shortcuts, `${formatChord(chord)} est déjà la touche Leader.`)
  }
  const owner = ownerOf(shortcuts, field, chord, command)
  const freed = owner ? withBinding(shortcuts, owner, { [field]: '' }) : shortcuts
  return {
    shortcuts: withBinding(freed, command, { [field]: chord }),
    notice: joinNotices([owner ? `${formatChord(chord)} retiré de « ${labelOf(owner)} ».` : null, field === ShortcutField.Direct ? terminalKeyWarning(chord) : null]),
    error: null,
  }
}

export const assignLeader = (shortcuts: ShortcutSettings, chord: string): ShortcutChange => {
  const problem = leaderChordProblem(chord)
  if (problem) {
    return unchanged(shortcuts, problem)
  }
  const directOwner = ownerOf(shortcuts, ShortcutField.Direct, chord, '')
  const leaderOwner = ownerOf(shortcuts, ShortcutField.Leader, chord, '')
  const withoutDirect = directOwner ? withBinding(shortcuts, directOwner, { direct: '' }) : shortcuts
  const freed = leaderOwner ? withBinding(withoutDirect, leaderOwner, { leader: '' }) : withoutDirect
  const owner = directOwner ?? leaderOwner
  return {
    shortcuts: { ...freed, leader: chord },
    notice: joinNotices([owner ? `${formatChord(chord)} retiré de « ${labelOf(owner)} ».` : null, leaderWarning(chord)]),
    error: null,
  }
}

export const resetCommand = (shortcuts: ShortcutSettings, defaults: ShortcutSettings, command: Command): ShortcutChange => {
  const { direct, leader } = bindingOf(defaults, command)
  const cleared = withBinding(shortcuts, command, EMPTY_BINDING)
  const withDirect = direct ? assignShortcut(cleared, command, ShortcutField.Direct, direct) : { shortcuts: cleared, notice: null, error: null }
  const withLeader = leader ? assignShortcut(withDirect.shortcuts, command, ShortcutField.Leader, leader) : withDirect
  return { shortcuts: withLeader.shortcuts, notice: joinNotices([withDirect.notice, withDirect === withLeader ? null : withLeader.notice]), error: withDirect.error ?? withLeader.error }
}

export const isDefaultBinding = (shortcuts: ShortcutSettings, defaults: ShortcutSettings, command: Command): boolean => {
  const current = bindingOf(shortcuts, command)
  const initial = bindingOf(defaults, command)
  return current.direct === initial.direct && current.leader === initial.leader
}
