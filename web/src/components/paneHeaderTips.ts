import { Command } from '../keyboard/commands'
import { useShortcutTip } from '../keyboard/shortcutLabels'

export interface PaneHeaderTips {
  splitSideBySide: string
  splitTopBottom: string
  reduce: string
  close: string
}

export const usePaneHeaderTips = (): PaneHeaderTips => ({
  splitSideBySide: useShortcutTip('Split côte à côte', Command.SplitSideBySide),
  splitTopBottom: useShortcutTip('Split haut / bas', Command.SplitTopBottom),
  reduce: useShortcutTip('Réduire le pane et revoir les autres', Command.TogglePaneZoom),
  close: useShortcutTip('Fermer le pane', Command.ClosePane),
})
