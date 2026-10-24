import { create } from 'zustand'
import type { ShortcutSettings } from '../bridge/messages'
import { Command } from '../keyboard/commands'

const DEFAULT_LEADER = 'Ctrl+Space'
const DEFAULT_LEADER_TIMEOUT_SECONDS = 5

export enum ShortcutField {
  Direct = 'direct',
  Leader = 'leader',
}

interface ShortcutState {
  settings: ShortcutSettings
  directIndex: Record<string, Command>
  leaderIndex: Record<string, Command>
  setShortcuts: (settings: ShortcutSettings) => void
}

const KNOWN_COMMANDS = new Set<string>(Object.values(Command))

const indexOf = (settings: ShortcutSettings, field: ShortcutField): Record<string, Command> =>
  Object.fromEntries(
    Object.entries(settings.bindings)
      .filter(([command, binding]) => KNOWN_COMMANDS.has(command) && binding[field].length > 0)
      .map(([command, binding]) => [binding[field], command as Command]),
  )

export const useShortcutStore = create<ShortcutState>()((set) => ({
  settings: { leader: DEFAULT_LEADER, leaderTimeoutSeconds: DEFAULT_LEADER_TIMEOUT_SECONDS, bindings: {} },
  directIndex: {},
  leaderIndex: {},
  setShortcuts: (settings) => set({ settings, directIndex: indexOf(settings, ShortcutField.Direct), leaderIndex: indexOf(settings, ShortcutField.Leader) }),
}))
