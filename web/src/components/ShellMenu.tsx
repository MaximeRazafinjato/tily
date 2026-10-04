import type { ShellProfile } from '../bridge/messages'
import { ActionMenu } from './ActionMenu'

interface ShellMenuProps {
  shells: ShellProfile[]
  onSelect: (shellId: string) => void
  onBrowser?: () => void
  onClose: () => void
}

const BROWSER_ITEM = 'browser'

export function ShellMenu({ shells, onSelect, onBrowser, onClose }: ShellMenuProps) {
  const shellItems = shells.map((shell) => ({ id: shell.id, label: shell.name, run: () => onSelect(shell.id) }))
  const items = onBrowser ? [...shellItems, { id: BROWSER_ITEM, label: 'Navigateur', run: onBrowser }] : shellItems
  return <ActionMenu label={onBrowser ? 'Choisir le shell ou un navigateur' : 'Choisir le shell'} items={items} emptyMessage="Aucun shell disponible" onClose={onClose} />
}
