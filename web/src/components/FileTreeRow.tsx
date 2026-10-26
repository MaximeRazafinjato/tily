import { memo, type DragEvent, type MouseEvent } from 'react'
import type { FileEntry, GitPathMark } from '../bridge/messages'
import { fileMarkView, folderMarkView } from '../explorer/gitMarks'
import { renameSelectionEnd } from '../explorer/fileTree'
import { TREE_PATH_TYPE, treeDragValue } from '../terminal/externalDrop'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { InlineNameEditor } from './InlineNameEditor'
import { rowIndent, type FileTreeHandlers } from './fileTreeHandlers'

interface FileTreeRowProps {
  entry: FileEntry
  parent: string
  depth: number
  selected: boolean
  focusable: boolean
  expanded: boolean
  renaming: boolean
  mark?: GitPathMark
  handlers: FileTreeHandlers
}

export const FileTreeRow = memo(function FileTreeRow({ entry, parent, depth, selected, focusable, expanded, renaming, mark, handlers }: FileTreeRowProps) {
  const markView = mark ? (entry.isDirectory ? folderMarkView(mark) : fileMarkView(mark)) : undefined
  const handleClick = () => {
    handlers.select(entry.path)
    if (entry.isDirectory && !renaming) {
      handlers.toggle(entry.path)
    } else if (entry.preview && !renaming) {
      handlers.activate(entry)
    }
  }
  const handleDoubleClick = () => {
    if (!entry.isDirectory && !entry.preview) {
      handlers.activate(entry)
    }
  }
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    handlers.select(entry.path)
    handlers.openMenu({ x: event.clientX, y: event.clientY, entry, parent })
  }
  const handleCommitRename = (name: string) => handlers.commitRename(entry, parent, name)
  const handleDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(TREE_PATH_TYPE, treeDragValue(entry.path))
    event.dataTransfer.setData('text/plain', entry.path)
    event.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      role="treeitem"
      data-file-row={entry.path}
      tabIndex={focusable ? 0 : -1}
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={entry.isDirectory ? expanded : undefined}
      className={`flex h-[22px] cursor-pointer items-center gap-[5px] pr-[8px] text-[12px] select-none ${selected ? 'bg-tily-green-soft text-tily-green-deep' : 'text-tily-ink-soft hover:bg-tily-green-hover hover:text-tily-ink'}`}
      style={{ paddingLeft: rowIndent(depth) }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      draggable={!renaming}
      onDragStart={handleDragStart}
    >
      <span className="flex w-[12px] shrink-0 justify-center text-tily-muted">
        {entry.isDirectory && <Icon name={IconName.Chevron} size={10} className={expanded ? 'rotate-90' : ''} />}
      </span>
      <Icon name={entry.isDirectory ? IconName.Folder : IconName.File} className="shrink-0 text-tily-muted" />
      {renaming ? (
        <InlineNameEditor value={entry.name} label={`Nouveau nom de ${entry.name}`} className="h-[18px] min-w-0 flex-1 text-[12px]" selectionEnd={renameSelectionEnd(entry)} onCommit={handleCommitRename} onCancel={handlers.cancelRename} />
      ) : (
        <span className={`min-w-0 truncate ${markView && !selected ? markView.className : ''}`}>{entry.name}</span>
      )}
      {markView && !renaming && (
        <span className={`ml-auto w-[12px] shrink-0 text-center text-[11px] font-semibold ${markView.className}`} data-tip={markView.label}>
          {markView.letter}
        </span>
      )}
    </div>
  )
})
