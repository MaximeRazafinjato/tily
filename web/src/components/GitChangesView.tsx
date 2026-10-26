import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GitDiffSource, type GitState } from '../bridge/gitMessages'
import { changeMenu, changeMenuLabel, discardSelection, toggleSelection } from '../git/gitChangeMenu'
import { focusGitPanel, focusGitRow } from '../git/gitFocus'
import { plural } from '../git/gitLabels'
import { discardChanges, openGitMenu, openInEditor, resolveConflict, stageChanges, unstageChanges } from '../git/gitRequests'
import { changeRows, drawerShowsWorkingFile, GitRowGroup, GitSelectMode, nextSelection, openChangeRow, rowKey, type GitChangeRow, type GitRowHandlers } from '../git/gitRows'
import { useGitStore } from '../store/gitStore'
import { GitCommitBox } from './GitCommitBox'
import { GitFileRow } from './GitFileRow'
import { GitGroupHeader } from './GitGroupHeader'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { ROW_ACTION, ROW_STAGE_BUTTON, ROW_UNSTAGE_BUTTON } from './rightPanelStyles'

interface GitChangesViewProps {
  state: GitState
  busy: string | null
  footer: ReactNode
}

const MENU_OFFSET_PX = 16

const hiddenNote = (shown: number, total: number) =>
  total > shown ? <p className="py-[2px] pl-[30px] text-[11px] text-tily-muted italic">{`… et ${plural(total - shown, 'autre fichier non affiché', 'autres fichiers non affichés')}`}</p> : null

const applySelection = (rows: GitChangeRow[], row: GitChangeRow, mode: GitSelectMode): void => {
  const { changeSelection, setChangeSelection } = useGitStore.getState()
  const { keys, anchor } = changeSelection
  const keepAnchor = mode === GitSelectMode.Range && rows.some((candidate) => candidate.key === anchor)
  setChangeSelection({ keys: nextSelection(rows.map((candidate) => candidate.key), keys, anchor, row.key, mode), anchor: keepAnchor ? anchor : row.key })
}

const actedRows = (rows: GitChangeRow[], row: GitChangeRow): GitChangeRow[] => {
  const { keys } = useGitStore.getState().changeSelection
  return keys.has(row.key) ? rows.filter((candidate) => keys.has(candidate.key)) : [row]
}

const openSelectionMenu = (rows: GitChangeRow[], row: GitChangeRow, x: number, y: number): void => {
  const { state, changeSelection, setChangeSelection } = useGitStore.getState()
  if (!state) {
    return
  }
  if (!changeSelection.keys.has(row.key)) {
    setChangeSelection({ keys: new Set([row.key]), anchor: row.key })
  }
  const selected = actedRows(rows, row)
  const restoreFocus = () => {
    if (!focusGitRow(row.key)) {
      focusGitPanel()
    }
  }
  openGitMenu({ x, y, label: changeMenuLabel(selected), items: changeMenu(selected, state), restoreFocus })
}

export function GitChangesView({ state, busy, footer }: GitChangesViewProps) {
  const { file, commit, selection } = useGitStore(useShallow((store) => ({ file: store.file, commit: store.commit, selection: store.changeSelection.keys })))
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const rows = useMemo(() => changeRows(state.conflicts, state.staged, state.unstaged), [state.conflicts, state.staged, state.unstaged])
  const selectedKey = file && !commit ? rowKey(file.source === GitDiffSource.Staged ? GitRowGroup.Staged : GitRowGroup.Unstaged, file.path) : null
  const focusableKey = rows.find((row) => row.key === focusKey)?.key ?? rows.find((row) => row.key === selectedKey)?.key ?? rows[0]?.key
  const highlighted = useMemo(() => (rows.some((row) => selection.has(row.key)) ? selection : new Set(selectedKey ? [selectedKey] : [])), [rows, selection, selectedKey])
  const handlers: GitRowHandlers = useMemo(
    () => ({
      open: openChangeRow,
      stage: (change) => stageChanges([change]),
      unstage: (change) => unstageChanges([change]),
      discard: (change) => discardChanges([change], 1),
      edit: openInEditor,
      resolve: resolveConflict,
      select: (row, mode) => {
        setFocusKey(row.key)
        applySelection(rows, row, mode)
        if (mode === GitSelectMode.Replace && !row.conflict) {
          openChangeRow(row)
        }
      },
      menu: (row, x, y) => {
        setFocusKey(row.key)
        openSelectionMenu(rows, row, x, y)
      },
    }),
    [rows],
  )
  const empty = rows.length === 0

  const moveTo = (row: GitChangeRow | undefined, extend: boolean) => {
    if (!row) {
      return
    }
    setFocusKey(row.key)
    focusGitRow(row.key)
    applySelection(rows, row, extend ? GitSelectMode.Range : GitSelectMode.Replace)
    if (!extend && drawerShowsWorkingFile() && !row.conflict) {
      openChangeRow(row)
    }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const index = rows.findIndex((row) => row.key === target.dataset.gitRow)
    const current = rows[index]
    const extend = event.shiftKey
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'a') {
      useGitStore.getState().setChangeSelection({ keys: new Set(rows.map((row) => row.key)), anchor: current?.key ?? rows[0]?.key ?? null })
    } else if (event.key === 'ArrowDown') {
      moveTo(rows[index < 0 ? 0 : Math.min(index + 1, rows.length - 1)], extend)
    } else if (event.key === 'ArrowUp') {
      moveTo(rows[Math.max(index - 1, 0)], extend)
    } else if (event.key === 'Home') {
      moveTo(rows[0], extend)
    } else if (event.key === 'End') {
      moveTo(rows.at(-1), extend)
    } else if (!current) {
      return
    } else if (event.key === 'Enter') {
      openChangeRow(current)
    } else if (event.key === ' ') {
      toggleSelection(actedRows(rows, current))
    } else if (event.key === 'Delete') {
      discardSelection(actedRows(rows, current))
    } else if (event.key === 'ContextMenu' || (extend && event.key === 'F10')) {
      const { left, bottom } = target.getBoundingClientRect()
      handlers.menu(current, left + MENU_OFFSET_PX, bottom)
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }
  const handleStageAll = () => stageChanges([])
  const handleUnstageAll = () => unstageChanges([])
  const handleDiscardAll = () => discardChanges([], state.unstagedTotal)
  const renderRows = (group: GitRowGroup) =>
    rows
      .filter((row) => row.group === group)
      .map((row) => <GitFileRow key={row.key} row={row} selected={highlighted.has(row.key)} focusable={row.key === focusableKey} handlers={handlers} />)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="listbox" aria-label="Modifications du dépôt" aria-multiselectable="true" className="min-h-0 flex-1 overflow-auto py-[4px]" onKeyDown={handleKeyDown}>
        {empty && <p className="px-[12px] py-[6px] text-[12px] text-tily-muted italic">Aucune modification : l’arbre de travail est propre.</p>}
        {state.conflicts.length > 0 && (
          <>
            <GitGroupHeader title="Conflits" count={state.conflicts.length} />
            {renderRows(GitRowGroup.Conflict)}
          </>
        )}
        {state.unstagedTotal > 0 && (
          <>
            <GitGroupHeader title="Unstaged" count={state.unstagedTotal}>
              <button type="button" className={`${ROW_ACTION} hover:text-tily-error`} aria-label="Tout abandonner" data-tip="Abandonner toutes les modifications unstaged" onClick={handleDiscardAll}>
                <Icon name={IconName.Discard} />
              </button>
              <button type="button" className={ROW_STAGE_BUTTON} aria-label="Stage de tout" data-tip="Stage de tout" onClick={handleStageAll}>
                <Icon name={IconName.Plus} />
              </button>
            </GitGroupHeader>
            {renderRows(GitRowGroup.Unstaged)}
            {hiddenNote(state.unstaged.length, state.unstagedTotal)}
          </>
        )}
        {state.stagedTotal > 0 && (
          <>
            <GitGroupHeader title="Staged" count={state.stagedTotal}>
              <button type="button" className={ROW_UNSTAGE_BUTTON} aria-label="Unstage de tout" data-tip="Unstage de tout" onClick={handleUnstageAll}>
                <Icon name={IconName.Minus} />
              </button>
            </GitGroupHeader>
            {renderRows(GitRowGroup.Staged)}
            {hiddenNote(state.staged.length, state.stagedTotal)}
          </>
        )}
      </div>
      {footer}
      <GitCommitBox state={state} busy={busy} />
    </div>
  )
}
