import type { ActionMenuItem } from './ActionMenu'
import { FloatingMenu } from './FloatingMenu'
import { MenuShortcut } from './MenuShortcut'
import { Command } from '../keyboard/commands'
import { shortcutText } from '../keyboard/shortcutLabels'

export interface TerminalMenuRequest {
  x: number
  y: number
}

export interface TerminalMenuActions {
  copy: () => void
  copyLastOutput: () => void
  paste: () => void
  selectAll: () => void
  clearScrollback: () => void
  splitSideBySide: () => void
  splitTopBottom: () => void
  toggleZoom: () => void
  moveToNewTab: () => void
  close: () => void
}

interface TerminalContextMenuProps {
  request: TerminalMenuRequest
  canCopy: boolean
  zoomed: boolean
  actions: TerminalMenuActions
  onDismiss: () => void
}

const shortcutDetail = (command: Command) => {
  const keys = shortcutText(command)
  return keys ? <MenuShortcut keys={keys} /> : undefined
}

const itemsFor = (canCopy: boolean, zoomed: boolean, actions: TerminalMenuActions): ActionMenuItem[] => [
  { id: 'copy', label: 'Copier', detail: <MenuShortcut keys="Ctrl+Maj+C" />, disabled: !canCopy, run: actions.copy },
  { id: 'copy-last-output', label: 'Copier la sortie de la dernière commande', run: actions.copyLastOutput },
  { id: 'paste', label: 'Coller', detail: <MenuShortcut keys="Ctrl+Maj+V" />, run: actions.paste },
  { id: 'select-all', label: 'Tout sélectionner', run: actions.selectAll },
  { id: 'clear-scrollback', label: 'Effacer l’historique de défilement', run: actions.clearScrollback },
  { id: 'split-x', label: 'Split côte à côte', detail: shortcutDetail(Command.SplitSideBySide), run: actions.splitSideBySide },
  { id: 'split-y', label: 'Split haut / bas', detail: shortcutDetail(Command.SplitTopBottom), run: actions.splitTopBottom },
  { id: 'zoom', label: zoomed ? 'Réduire le pane' : 'Agrandir le pane', detail: shortcutDetail(Command.TogglePaneZoom), run: actions.toggleZoom },
  { id: 'move-to-new-tab', label: 'Déplacer dans un nouvel onglet', detail: shortcutDetail(Command.MovePaneToNewTab), run: actions.moveToNewTab },
  { id: 'close', label: 'Fermer le pane', detail: shortcutDetail(Command.ClosePane), run: actions.close },
]

export function TerminalContextMenu({ request, canCopy, zoomed, actions, onDismiss }: TerminalContextMenuProps) {
  const closingFirst = (item: ActionMenuItem): ActionMenuItem => ({
    ...item,
    run: () => {
      onDismiss()
      item.run()
    },
  })

  return <FloatingMenu x={request.x} y={request.y} label="Actions du terminal" items={itemsFor(canCopy, zoomed, actions).map(closingFirst)} onClose={onDismiss} />
}
