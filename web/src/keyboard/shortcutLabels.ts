import type { ShortcutSettings } from '../bridge/messages'
import { useShortcutStore } from '../store/shortcutStore'
import { Command } from './commands'
import { formatChord } from './keyChords'

export const leaderKeyText = (key: string): string => `Leader puis ${formatChord(key)}`

export const shortcutTextIn = (settings: ShortcutSettings, command: Command): string | undefined => {
  const binding = settings.bindings[command]
  if (binding?.direct) {
    return formatChord(binding.direct)
  }
  return binding?.leader ? leaderKeyText(binding.leader) : undefined
}

export const shortcutText = (command: Command): string | undefined => shortcutTextIn(useShortcutStore.getState().settings, command)

export const withShortcut = (text: string, shortcut: string | undefined): string => (shortcut ? `${text} (${shortcut})` : text)

export const useShortcutText = (command: Command): string | undefined => useShortcutStore((state) => shortcutTextIn(state.settings, command))

export const useShortcutTip = (text: string, command: Command): string => withShortcut(text, useShortcutText(command))

export const useLeaderText = (): string => useShortcutStore((state) => formatChord(state.settings.leader))

export const restoreHint = (): string => shortcutText(Command.RestoreTab) ?? '« Rouvrir le dernier onglet fermé » dans la palette'

const PANEL_COMMANDS = [Command.ToggleExplorer, Command.ToggleGit, Command.ToggleNotes]

const listText = (items: string[]): string | undefined => (items.length > 1 ? `${items.slice(0, -1).join(', ')} ou ${items.at(-1)}` : items[0])

export const usePanelShortcuts = (): string | undefined =>
  useShortcutStore((state) => listText(PANEL_COMMANDS.flatMap((command) => shortcutTextIn(state.settings, command) ?? [])))
