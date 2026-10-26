import { useMemo, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { bridge } from '../bridge/bridge'
import { GitDiffLineKind, GitDiffSource, type GitDiff } from '../bridge/gitMessages'
import { applyDiffSelection, clearDiffSelection, DiffLineAction, DiffPick, moveDiffCursor, moveDiffHunk, pickDiffRow, selectAllDiffLines, toggleStageDiffSelection } from '../git/gitDiffActions'
import { diffRowsOf, DiffRowKind, hunkHeaderRow, isChangeRow, type DiffRow } from '../git/gitDiffRows'
import { absolutePath } from '../git/gitLabels'
import { useGitStore, type GitDiffSelection } from '../store/gitStore'
import { GitDiffHunkActions } from './GitDiffHunkActions'
import { GitDiffLineAction } from './GitDiffLineAction'
import { GitDiffSelectionBar } from './GitDiffSelectionBar'
import { useVirtualRows } from './useVirtualRows'

interface GitDiffViewProps {
  diff: GitDiff | null
  error: string | null
  placeholder: string
  selectable: GitDiffSource | null
}

const LINE_HEIGHT = 18
const PICK_SELECTOR = '[data-diff-pick]'

const LINE_CLASSES: Record<GitDiffLineKind, string> = {
  [GitDiffLineKind.Context]: 'text-tily-terminal-ink',
  [GitDiffLineKind.Added]: 'bg-tily-diff-added text-tily-diff-added-ink',
  [GitDiffLineKind.Removed]: 'bg-tily-diff-removed text-tily-diff-removed-ink',
  [GitDiffLineKind.Note]: 'text-tily-muted italic',
}

const SELECTED_CLASSES: Partial<Record<GitDiffLineKind, string>> = {
  [GitDiffLineKind.Added]: 'bg-tily-diff-added-selected text-tily-diff-added-ink shadow-[inset_3px_0_0_var(--color-tily-focus)]',
  [GitDiffLineKind.Removed]: 'bg-tily-diff-removed-selected text-tily-diff-removed-ink shadow-[inset_3px_0_0_var(--color-tily-focus)]',
}

const LINE_SIGNS: Record<GitDiffLineKind, string> = {
  [GitDiffLineKind.Context]: ' ',
  [GitDiffLineKind.Added]: '+',
  [GitDiffLineKind.Removed]: '−',
  [GitDiffLineKind.Note]: ' ',
}

const CURSOR_CLASSES = 'group-focus:outline group-focus:outline-1 group-focus:-outline-offset-1 group-focus:outline-tily-focus'
const PICK_CLASSES = 'cursor-pointer hover:bg-tily-green-hover/60'
const PICK_TIP = 'Choisir la ligne'

const renderHunk = (row: DiffRow, style: { top: number; height: number }, index: number, selectable: GitDiffSource | null) => {
  if (!selectable || row.hunk === undefined) {
    return (
      <div key={index} className="absolute left-0 w-max min-w-full bg-tily-panel px-[10px] text-tily-lane-1" style={style}>
        {row.text}
      </div>
    )
  }
  return (
    <div key={index} className={`absolute left-0 flex w-max min-w-full bg-tily-panel text-tily-lane-1 ${PICK_CLASSES}`} style={style} data-diff-pick="" data-tip="Choisir le chunk">
      <GitDiffHunkActions hunk={row.hunk} source={selectable} />
      <span className="pr-[16px] whitespace-pre">{row.text}</span>
    </div>
  )
}

const renderRow = (row: DiffRow, index: number, selection: GitDiffSelection, selectable: GitDiffSource | null) => {
  const style = { top: index * LINE_HEIGHT, height: LINE_HEIGHT }
  if (row.kind === DiffRowKind.Hunk) {
    return renderHunk(row, style, index, selectable)
  }
  if (!row.line) {
    return (
      <div key={index} className="absolute left-0 w-max min-w-full px-[10px] font-sans text-tily-muted italic" style={style}>
        {row.text}
      </div>
    )
  }
  const { kind, old, new: next } = row.line
  const pickable = selectable !== null && isChangeRow(row)
  const selected = selection.rows.has(index)
  const colors = (selected && SELECTED_CLASSES[kind]) || LINE_CLASSES[kind]
  const cursor = pickable && selection.cursor === index ? CURSOR_CLASSES : ''
  return (
    <div key={index} className={`group/line absolute left-0 flex w-max min-w-full ${colors} ${cursor}`} style={style}>
      {selectable && (
        <span className="flex w-[24px] shrink-0 items-center justify-center">
          {pickable && <GitDiffLineAction row={index} source={selectable} inSelection={selected} shown={selection.cursor === index} />}
        </span>
      )}
      <span className={`flex shrink-0 ${pickable ? PICK_CLASSES : ''}`} data-diff-pick={pickable ? '' : undefined} data-tip={pickable ? PICK_TIP : undefined}>
        <span className="w-[46px] shrink-0 pr-[8px] text-right text-tily-muted select-none">{old ?? ''}</span>
        <span className="w-[46px] shrink-0 pr-[8px] text-right text-tily-muted select-none">{next ?? ''}</span>
        <span className="w-[16px] shrink-0 select-none">{LINE_SIGNS[kind]}</span>
      </span>
      <span className="pr-[16px] whitespace-pre">{row.text}</span>
    </div>
  )
}

export function GitDiffView({ diff, error, placeholder, selectable }: GitDiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggedRow = useRef<number | null>(null)
  const selection = useGitStore((store) => store.diffSelection)
  const rows = useMemo(() => (diff ? diffRowsOf(diff) : []), [diff])
  const { range, handleScroll } = useVirtualRows(containerRef, rows.length, LINE_HEIGHT)

  if (error || !diff) {
    return <p className={`px-[12px] py-[10px] text-[12px] ${error ? 'text-tily-error' : 'text-tily-muted italic'}`}>{error ?? placeholder}</p>
  }

  const rowAt = (clientY: number): number => {
    const container = containerRef.current
    return container ? Math.floor((clientY - container.getBoundingClientRect().top + container.scrollTop) / LINE_HEIGHT) : -1
  }

  const topRow = (): number => Math.floor((containerRef.current?.scrollTop ?? 0) / LINE_HEIGHT)

  const reveal = (first: number, last: number) => {
    const container = containerRef.current
    if (!container || first < 0) {
      return
    }
    const top = Math.max(0, first - 1) * LINE_HEIGHT
    const bottom = (last + 2) * LINE_HEIGHT
    if (top < container.scrollTop) {
      container.scrollTop = top
    } else if (bottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = Math.min(top, bottom - container.clientHeight)
    }
  }

  const revealCursor = (withHeader: boolean) => {
    const { cursor } = useGitStore.getState().diffSelection
    const hunk = cursor === null ? undefined : rows[cursor]?.hunk
    if (cursor !== null) {
      reveal(withHeader && hunk !== undefined ? hunkHeaderRow(rows, hunk) : cursor, cursor)
    }
  }

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null
    const onButton = Boolean(target?.closest('button'))
    if (!selectable || event.button !== 0 || !target || (!onButton && !target.closest(PICK_SELECTOR))) {
      return
    }
    event.preventDefault()
    containerRef.current?.focus()
    if (onButton) {
      return
    }
    const row = rowAt(event.clientY)
    pickDiffRow(row, event.shiftKey ? DiffPick.Extend : event.ctrlKey ? DiffPick.Toggle : DiffPick.Replace)
    draggedRow.current = event.ctrlKey || rows[row]?.kind === DiffRowKind.Hunk ? null : row
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null
    const line = rows[rowAt(event.clientY)]?.line
    const state = useGitStore.getState().state
    const selecting = !(window.getSelection()?.isCollapsed ?? true)
    if (!selectable || !event.ctrlKey || selecting || !target || target.closest(PICK_SELECTOR) || target.closest('button') || !line?.new || !state) {
      return
    }
    event.preventDefault()
    const shifted = selectable === GitDiffSource.Staged && state.unstaged.some((change) => change.path === diff.path)
    bridge.send({ type: 'files.openAt', path: absolutePath(state.root, diff.path), line: shifted ? 0 : line.new, column: shifted ? 0 : 1 })
  }

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (draggedRow.current === null) {
      return
    }
    if (event.buttons !== 1) {
      draggedRow.current = null
      return
    }
    const row = rowAt(event.clientY)
    if (row !== draggedRow.current) {
      draggedRow.current = row
      pickDiffRow(row, DiffPick.Extend)
    }
  }

  const handleMouseUp = () => {
    draggedRow.current = null
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selectable || event.altKey || event.metaKey) {
      return
    }
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const step = event.key === 'ArrowDown' ? 1 : -1
        if (event.ctrlKey) {
          moveDiffHunk(step, topRow())
        } else {
          moveDiffCursor(step, event.shiftKey, topRow())
        }
        revealCursor(event.ctrlKey)
        break
      }
      case ' ':
        if (event.ctrlKey || event.shiftKey) {
          return
        }
        toggleStageDiffSelection()
        break
      case 'Delete':
        if (selectable !== GitDiffSource.Unstaged) {
          return
        }
        applyDiffSelection(DiffLineAction.Discard)
        break
      case 'a':
      case 'A':
        if (!event.ctrlKey || event.shiftKey) {
          return
        }
        selectAllDiffLines()
        break
      case 'Escape':
        if (!clearDiffSelection()) {
          return
        }
        event.stopPropagation()
        break
      default:
        return
    }
    event.preventDefault()
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        tabIndex={0}
        data-git-diff=""
        aria-label={`Diff de ${diff.path}`}
        className="group relative min-h-0 flex-1 overflow-auto bg-tily-terminal font-mono text-[12px] leading-[18px] [tab-size:4]"
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div className="relative" style={{ height: rows.length * LINE_HEIGHT }}>
          {rows.slice(range.start, range.end).map((row, offset) => renderRow(row, range.start + offset, selection, selectable))}
        </div>
      </div>
      {selectable && selection.rows.size > 0 && <GitDiffSelectionBar count={selection.rows.size} source={selectable} />}
    </div>
  )
}
