import { openTabColor } from '../appearance/appearanceActions'
import { isManuallyNamed, type Session } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import type { ActionMenuItem } from './ActionMenu'
import { FloatingMenu } from './FloatingMenu'
import { MenuShortcut } from './MenuShortcut'
import { tabTransferItems } from './tabMenuItems'

export interface TabMenuRequest {
  tabId: string
  x: number
  y: number
  returnFocus: HTMLElement | null
}

export interface TabMenuActions {
  rename: (tabId: string) => void
  shift: (tabId: string, offset: number) => void
  duplicate: (tabId: string) => void
  close: (tabId: string) => void
  closeOthers: (tabId: string) => void
  closeToRight: (tabId: string) => void
}

interface TabContextMenuProps {
  request: TabMenuRequest
  position: number
  count: number
  actions: TabMenuActions
  onRun: () => void
  onDismiss: () => void
}

const itemsFor = ({ tabId }: TabMenuRequest, position: number, count: number, manual: boolean, session: Session | null, actions: TabMenuActions): ActionMenuItem[] => [
  { id: 'rename', label: 'Renommer', detail: <MenuShortcut keys="F2" />, run: () => actions.rename(tabId) },
  { id: 'auto-name', label: 'Reprendre le nom du dossier', disabled: !manual, run: () => useSessionStore.getState().resetTabName(tabId) },
  { id: 'duplicate', label: 'Dupliquer l’onglet', run: () => actions.duplicate(tabId) },
  { id: 'color', label: 'Couleur…', run: () => openTabColor(tabId) },
  { id: 'move-left', label: 'Déplacer à gauche', detail: <MenuShortcut keys="Alt+←" />, disabled: position <= 0, run: () => actions.shift(tabId, -1) },
  { id: 'move-right', label: 'Déplacer à droite', detail: <MenuShortcut keys="Alt+→" />, disabled: position < 0 || position >= count - 1, run: () => actions.shift(tabId, 1) },
  ...tabTransferItems(session, tabId),
  { id: 'close', label: 'Fermer l’onglet', detail: <MenuShortcut keys="Clic milieu" />, run: () => actions.close(tabId) },
  { id: 'close-others', label: 'Fermer les autres onglets', disabled: count <= 1, run: () => actions.closeOthers(tabId) },
  { id: 'close-right', label: 'Fermer les onglets à droite', disabled: position < 0 || position >= count - 1, run: () => actions.closeToRight(tabId) },
]

export function TabContextMenu({ request, position, count, actions, onRun, onDismiss }: TabContextMenuProps) {
  const manual = useSessionStore((state) => isManuallyNamed(state.session, request.tabId))
  const session = useSessionStore((state) => state.session)
  const closingFirst = (item: ActionMenuItem): ActionMenuItem => ({
    ...item,
    run: () => {
      onRun()
      item.run()
    },
  })

  return <FloatingMenu x={request.x} y={request.y} label="Actions de l’onglet" items={itemsFor(request, position, count, manual, session, actions).map(closingFirst)} onClose={onDismiss} />
}
