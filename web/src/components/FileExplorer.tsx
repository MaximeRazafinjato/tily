import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { EntryKind } from '../bridge/messages'
import { buildFileTree, RowKind, targetFolder } from '../explorer/fileTree'
import { refreshFolders, watchFolders } from '../explorer/fileExplorerActions'
import { useExplorerStore } from '../store/explorerStore'
import { FileTree } from './FileTree'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { PANEL_HEADER_BUTTON } from './rightPanelStyles'

interface FileExplorerProps {
  root: string
  onOpenTerminal: (path: string) => void
}

const WATCH_SEPARATOR = '\n'

export function FileExplorer({ root, onOpenTerminal }: FileExplorerProps) {
  const { listings, expanded, selectedPath, renamingPath, draft } = useExplorerStore(
    useShallow((state) => ({ listings: state.listings, expanded: state.expanded, selectedPath: state.selectedPath, renamingPath: state.renamingPath, draft: state.draft })),
  )
  const { rows, watched } = useMemo(() => buildFileTree(root, listings, expanded, draft), [root, listings, expanded, draft])
  const watchedKey = watched.join(WATCH_SEPARATOR)
  const rootListing = listings[root]
  const anyExpanded = rows.some((row) => row.kind === RowKind.Entry && row.entry?.isDirectory && expanded[row.entry.path])
  const empty = rootListing !== undefined && !rootListing.error && rootListing.entries.length === 0 && !draft

  useEffect(() => {
    watchFolders(watchedKey.split(WATCH_SEPARATOR))
  }, [watchedKey])
  useEffect(() => () => watchFolders([]), [])

  const handleNewFile = () => useExplorerStore.getState().startDraft({ parent: targetFolder(rows, selectedPath, root), kind: EntryKind.File })
  const handleCollapseAll = () => useExplorerStore.getState().collapseUnder(root)
  const handleNewFolder = () => useExplorerStore.getState().startDraft({ parent: targetFolder(rows, selectedPath, root), kind: EntryKind.Folder })

  return (
    <section aria-label="Explorateur de fichiers" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-[30px] shrink-0 items-center justify-end gap-[2px] pr-[6px] pl-[12px] text-tily-muted">
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Nouveau fichier" data-tip="Nouveau fichier" onClick={handleNewFile}>
          <Icon name={IconName.NewFile} />
        </button>
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Nouveau dossier" data-tip="Nouveau dossier" onClick={handleNewFolder}>
          <Icon name={IconName.NewFolder} />
        </button>
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Tout replier" data-tip="Tout replier" aria-disabled={!anyExpanded} onClick={handleCollapseAll}>
          <Icon name={IconName.CollapseAll} />
        </button>
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Actualiser" data-tip="Actualiser (F5)" onClick={refreshFolders}>
          <Icon name={IconName.Refresh} />
        </button>
      </div>
      {empty && <p className="px-[12px] py-[6px] text-[12px] text-tily-muted italic">Dossier vide.</p>}
      <FileTree root={root} rows={rows} expanded={expanded} selectedPath={selectedPath} renamingPath={renamingPath} draft={draft} onOpenTerminal={onOpenTerminal} />
    </section>
  )
}
