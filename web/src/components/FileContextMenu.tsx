import { EntryKind, type FileEntry } from '../bridge/messages'
import type { ActionMenuItem } from './ActionMenu'
import { FloatingMenu } from './FloatingMenu'
import { MenuShortcut } from './MenuShortcut'
import type { FileMenuRequest } from './fileTreeHandlers'

export interface FileMenuActions {
  open: (entry: FileEntry) => void
  preview: (path: string) => void
  openTerminal: (path: string) => void
  newEntry: (parent: string, kind: EntryKind) => void
  rename: (path: string) => void
  remove: (entry: FileEntry, parent: string) => void
  copyPath: (path: string) => void
  copyRelativePath: (path: string) => void
  insertPath: (path: string) => void
  reveal: (path: string) => void
  showChanges: (path: string) => void
  openFolder: (path: string) => void
  refresh: () => void
}

interface FileContextMenuProps {
  request: FileMenuRequest
  changed: boolean
  actions: FileMenuActions
  onDismiss: () => void
}

const itemsFor = ({ entry, parent }: FileMenuRequest, changed: boolean, actions: FileMenuActions): ActionMenuItem[] => {
  if (!entry) {
    return [
      { id: 'new-file', label: 'Nouveau fichier', run: () => actions.newEntry(parent, EntryKind.File) },
      { id: 'new-folder', label: 'Nouveau dossier', run: () => actions.newEntry(parent, EntryKind.Folder) },
      { id: 'terminal', label: 'Ouvrir un terminal ici', run: () => actions.openTerminal(parent) },
      { id: 'copy-path', label: 'Copier le chemin', run: () => actions.copyPath(parent) },
      { id: 'refresh', label: 'Actualiser', detail: <MenuShortcut keys="F5" />, run: actions.refresh },
    ]
  }
  const folder = entry.isDirectory ? entry.path : parent
  const openItems: ActionMenuItem[] = entry.isDirectory
    ? [
        { id: 'terminal', label: 'Ouvrir un terminal ici', run: () => actions.openTerminal(entry.path) },
        { id: 'open-folder', label: 'Ouvrir dans l’éditeur', run: () => actions.openFolder(entry.path) },
      ]
    : entry.preview
      ? [
          { id: 'preview', label: 'Aperçu', detail: <MenuShortcut keys="Entrée" />, run: () => actions.preview(entry.path) },
          { id: 'open', label: 'Ouvrir dans l’éditeur', run: () => actions.open(entry) },
        ]
      : [{ id: 'open', label: 'Ouvrir dans l’éditeur', detail: <MenuShortcut keys="Entrée" />, run: () => actions.open(entry) }]
  const fileTerminalItems: ActionMenuItem[] = entry.isDirectory ? [] : [{ id: 'terminal', label: 'Ouvrir un terminal dans son dossier', run: () => actions.openTerminal(parent) }]
  const changeItems: ActionMenuItem[] = changed && !entry.isDirectory ? [{ id: 'changes', label: 'Voir les modifications', run: () => actions.showChanges(entry.path) }] : []
  return [
    ...openItems,
    ...changeItems,
    ...fileTerminalItems,
    { id: 'new-file', label: 'Nouveau fichier', run: () => actions.newEntry(folder, EntryKind.File) },
    { id: 'new-folder', label: 'Nouveau dossier', run: () => actions.newEntry(folder, EntryKind.Folder) },
    { id: 'rename', label: 'Renommer', detail: <MenuShortcut keys="F2" />, run: () => actions.rename(entry.path) },
    { id: 'delete', label: 'Supprimer', detail: <MenuShortcut keys="Suppr" />, run: () => actions.remove(entry, parent) },
    { id: 'copy-path', label: 'Copier le chemin', detail: <MenuShortcut keys="Ctrl+C" />, run: () => actions.copyPath(entry.path) },
    { id: 'copy-relative-path', label: 'Copier le chemin relatif', detail: <MenuShortcut keys="Ctrl+Maj+C" />, run: () => actions.copyRelativePath(entry.path) },
    { id: 'insert-path', label: 'Insérer le chemin dans le terminal', run: () => actions.insertPath(entry.path) },
    { id: 'reveal', label: 'Afficher dans l’Explorateur Windows', run: () => actions.reveal(entry.path) },
  ]
}

export function FileContextMenu({ request, changed, actions, onDismiss }: FileContextMenuProps) {
  const closingFirst = (item: ActionMenuItem): ActionMenuItem => ({
    ...item,
    run: () => {
      onDismiss()
      item.run()
    },
  })

  return <FloatingMenu x={request.x} y={request.y} label={request.entry ? `Actions de ${request.entry.name}` : 'Actions du dossier'} items={itemsFor(request, changed, actions).map(closingFirst)} onClose={onDismiss} />
}
