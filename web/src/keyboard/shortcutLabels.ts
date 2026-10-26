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
