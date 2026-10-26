import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { EntryKind, type FileEntry } from '../bridge/messages'
import { entryRows, relativeEntryPath, RowKind, type TreeRow } from '../explorer/fileTree'
import {
  copyEntryPath,
  createEntry,
  focusActivePane,
  focusFileRow,
  insertPathInActivePane,
  openFile,
  openFolderInEditor,
  revealInExplorer,
  refocusFileTreeIfLost,
  refreshFolders,
  renameEntry,
} from '../explorer/fileExplorerActions'
import { Command, isCommandShortcut } from '../keyboard/shortcuts'
import { NO_TYPED_TEXT, typeAheadIndex, typeAheadText, type TypedText } from '../keyboard/typeAhead'
import { RightPanelView } from '../model/session'
import { togglePanelView } from '../panel/rightPanel'
import { closePreview, openPreview } from '../preview/previewActions'
import { usePreviewStore } from '../store/previewStore'
import { useExplorerStore, type EntryDraft } from '../store/explorerStore'
import { markKey } from '../explorer/gitMarks'
import { showFileChanges } from '../panel/rightPanel'
import { FileContextMenu, type FileMenuActions } from './FileContextMenu'
import { FileTreeRow } from './FileTreeRow'
import { leafIndent, type FileMenuRequest, type FileTreeHandlers } from './fileTreeHandlers'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { InlineNameEditor } from './InlineNameEditor'
import { isMenuKey } from './workspacePanel'

interface FileTreeProps {
  root: string
  rows: TreeRow[]
  expanded: Record<string, boolean>
  selectedPath: string | null
  renamingPath: string | null
  draft: EntryDraft | null
  onOpenTerminal: (path: string) => void
}

const toggleFolder = (path: string): void => {
  const { expanded, setExpanded } = useExplorerStore.getState()
  setExpanded(path, !expanded[path])
}

const activateEntry = (entry: FileEntry): void => {
  if (entry.isDirectory) {
    toggleFolder(entry.path)
  } else if (entry.preview) {
    openPreview(entry.path)
  } else {
    openFile(entry)
  }
}

const requestDelete = (entry: FileEntry, parent: string): void =>
  useExplorerStore.getState().requestDelete({ path: entry.path, parent, name: entry.name, isDirectory: entry.isDirectory })

const startRename = (path: string): void => useExplorerStore.getState().startRename(path)

const handleCommitRename = (entry: FileEntry, parent: string, name: string): void => {
  useExplorerStore.getState().stopRename()
  renameEntry(entry, parent, name)
  refocusFileTreeIfLost()
}

const handleCancelRename = (): void => {
  useExplorerStore.getState().stopRename()
  refocusFileTreeIfLost()
}

const handleCancelDraft = (): void => {
  useExplorerStore.getState().stopDraft()
  refocusFileTreeIfLost()
}

const selectAndFocus = (row: TreeRow | undefined): void => {
  if (row?.entry) {
    useExplorerStore.getState().select(row.entry.path)
    focusFileRow(row.entry.path)
  }
}

export function FileTree({ root, rows, expanded, selectedPath, renamingPath, draft, onOpenTerminal }: FileTreeProps) {
  const [menu, setMenu] = useState<FileMenuRequest | null>(null)
  const gitMarks = useExplorerStore((state) => state.gitMarks)
  const gitFolderMarks = useExplorerStore((state) => state.gitFolderMarks)
  const treeRef = useRef<HTMLDivElement>(null)
  const entries = entryRows(rows)
  const selectedIndex = entries.findIndex((row) => row.entry?.path === selectedPath)
  const focusablePath = entries[Math.max(selectedIndex, 0)]?.entry?.path
  const typedRef = useRef(NO_TYPED_TEXT)

  useEffect(() => {
    if (focusablePath && document.activeElement === treeRef.current) {
      focusFileRow(focusablePath)
    }
  }, [focusablePath])

  const handlers: FileTreeHandlers = useMemo(
    () => ({
      select: (path) => useExplorerStore.getState().select(path),
      activate: activateEntry,
      toggle: toggleFolder,
      openMenu: setMenu,
      commitRename: handleCommitRename,
      cancelRename: handleCancelRename,
    }),
    [],
  )
  const menuActions: FileMenuActions = {
    open: openFile,
    preview: openPreview,
    openTerminal: onOpenTerminal,
    newEntry: (parent, kind) => useExplorerStore.getState().startDraft({ parent, kind }),
    rename: startRename,
    remove: requestDelete,
    copyPath: copyEntryPath,
    copyRelativePath: (path) => copyEntryPath(relativeEntryPath(root, path)),
    insertPath: insertPathInActivePane,
    reveal: revealInExplorer,
    showChanges: showFileChanges,
    openFolder: openFolderInEditor,
    refresh: refreshFolders,
  }

  const handleDismissMenu = useCallback(() => {
    setMenu(null)
    refocusFileTreeIfLost()
  }, [])
  const handleBackgroundMenu = (event: MouseEvent) => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, parent: root })
  }
  const handleCommitDraft = (name: string) => {
    if (draft) {
      createEntry(draft.parent, name, draft.kind)
    }
    handleCancelDraft()
  }
  const openRowMenu = (row: TreeRow) => {
    const element = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const rect = element?.getBoundingClientRect()
    setMenu({ x: rect ? rect.left + rect.width / 2 : 0, y: rect ? rect.bottom : 0, entry: row.entry, parent: row.parent })
  }

  const jumpToTyped = (typed: TypedText) => {
    typedRef.current = typed
    selectAndFocus(entries[typeAheadIndex(entries.map((row) => row.entry?.name ?? ''), selectedIndex, typed.text)])
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = entries[selectedIndex]
    const entry = current?.entry
    const typed = typeAheadText(typedRef.current, event)
    if (isCommandShortcut(event.nativeEvent, Command.ToggleExplorer)) {
      togglePanelView(RightPanelView.Files, true)
    } else if (isCommandShortcut(event.nativeEvent, Command.ToggleGit)) {
      togglePanelView(RightPanelView.Git, true)
    } else if (event.key === 'ArrowDown') {
      selectAndFocus(entries[selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, entries.length - 1)])
    } else if (event.key === 'ArrowUp') {
      selectAndFocus(entries[Math.max(selectedIndex - 1, 0)])
    } else if (event.key === 'Home') {
      selectAndFocus(entries[0])
    } else if (event.key === 'End') {
      selectAndFocus(entries.at(-1))
    } else if (event.key === 'Escape' && usePreviewStore.getState().path !== null) {
      closePreview()
    } else if (event.key === 'Escape') {
      focusActivePane()
    } else if (event.key === 'F5') {
      if (!event.repeat) {
        refreshFolders()
      }
    } else if (typed) {
      jumpToTyped(typed)
    } else if (!current || !entry) {
      return
    } else if (event.key === 'ArrowRight' && entry.isDirectory) {
      if (expanded[entry.path]) {
        selectAndFocus(entries[selectedIndex + 1]?.parent === entry.path ? entries[selectedIndex + 1] : undefined)
      } else {
        toggleFolder(entry.path)
      }
    } else if (event.key === 'ArrowLeft') {
      if (entry.isDirectory && expanded[entry.path]) {
        toggleFolder(entry.path)
      } else {
        selectAndFocus(entries.find((row) => row.entry?.path === current.parent))
      }
    } else if (event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'c') {
      copyEntryPath(event.shiftKey ? relativeEntryPath(root, entry.path) : entry.path)
    } else if (event.key === 'Enter') {
      activateEntry(entry)
    } else if (event.key === 'F2') {
      startRename(entry.path)
    } else if (event.key === 'Delete') {
      requestDelete(entry, current.parent)
    } else if (isMenuKey(event)) {
      openRowMenu(current)
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <>
      <div
        ref={treeRef}
        role="tree"
        aria-label="Fichiers du dossier courant"
        data-file-tree=""
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-auto pb-[8px] focus:outline-none"
        onKeyDown={handleKeyDown}
        onContextMenu={handleBackgroundMenu}
      >
        {rows.map((row) => {
          if (row.kind === RowKind.Entry && row.entry) {
            return (
              <FileTreeRow
                key={row.key}
                entry={row.entry}
                parent={row.parent}
                depth={row.depth}
                selected={row.entry.path === selectedPath}
                focusable={row.entry.path === focusablePath}
                expanded={Boolean(expanded[row.entry.path])}
                renaming={row.entry.path === renamingPath}
                mark={(row.entry.isDirectory ? gitFolderMarks.get(markKey(row.entry.path)) : undefined) ?? gitMarks.get(markKey(row.entry.path))}
                handlers={handlers}
              />
            )
          }
          if (row.kind === RowKind.Draft && draft) {
            return (
              <div key={row.key} className="flex h-[22px] items-center gap-[5px] pr-[8px]" style={{ paddingLeft: leafIndent(row.depth) }}>
                <Icon name={draft.kind === EntryKind.Folder ? IconName.Folder : IconName.File} className="shrink-0 text-tily-muted" />
                <InlineNameEditor value="" label={draft.kind === EntryKind.Folder ? 'Nom du nouveau dossier' : 'Nom du nouveau fichier'} className="h-[18px] min-w-0 flex-1 text-[12px]" onCommit={handleCommitDraft} onCancel={handleCancelDraft} />
              </div>
            )
          }
          return (
            <div key={row.key} className="flex h-[22px] items-center truncate pr-[8px] text-[12px] text-tily-muted italic" style={{ paddingLeft: leafIndent(row.depth) }}>
              {row.note}
            </div>
          )
        })}
      </div>
      {menu && <FileContextMenu request={menu} changed={Boolean(menu.entry && gitMarks.get(markKey(menu.entry.path)) && !gitMarks.get(markKey(menu.entry.path))?.conflicted)} actions={menuActions} onDismiss={handleDismissMenu} />}
    </>
  )
}
