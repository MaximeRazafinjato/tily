import { GitDiffSource, type GitConflict, type GitFileChange } from '../bridge/gitMessages'
import { openInEditor, showChange } from './gitRequests'

export enum GitRowGroup {
  Conflict = 'conflict',
  Staged = 'staged',
  Unstaged = 'unstaged',
}

export enum GitSelectMode {
  Replace = 'replace',
  Toggle = 'toggle',
  Range = 'range',
}

export interface GitChangeRow {
  key: string
  group: GitRowGroup
  change?: GitFileChange
  conflict?: GitConflict
}

export interface GitRowHandlers {
  open: (row: GitChangeRow) => void
  stage: (change: GitFileChange) => void
  unstage: (change: GitFileChange) => void
  discard: (change: GitFileChange) => void
  edit: (path: string) => void
  resolve: (conflict: GitConflict) => void
  select: (row: GitChangeRow, mode: GitSelectMode) => void
  menu: (row: GitChangeRow, x: number, y: number) => void
}

export const rowKey = (group: GitRowGroup, path: string): string => `${group}\n${path}`

export const rowPath = ({ change, conflict }: GitChangeRow): string => change?.path ?? conflict?.path ?? ''

export const selectModeOf = ({ ctrlKey, metaKey, shiftKey }: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): GitSelectMode =>
  shiftKey ? GitSelectMode.Range : ctrlKey || metaKey ? GitSelectMode.Toggle : GitSelectMode.Replace

export const nextSelection = (order: string[], selection: ReadonlySet<string>, anchor: string | null, key: string, mode: GitSelectMode): Set<string> => {
  if (mode === GitSelectMode.Toggle) {
    const toggled = new Set(selection)
    if (!toggled.delete(key)) {
      toggled.add(key)
    }
    return toggled
  }
  const start = anchor === null ? -1 : order.indexOf(anchor)
  const end = order.indexOf(key)
  if (mode === GitSelectMode.Replace || start < 0 || end < 0) {
    return new Set([key])
  }
  return new Set(order.slice(Math.min(start, end), Math.max(start, end) + 1))
}

export const changeRows = (conflicts: GitConflict[], staged: GitFileChange[], unstaged: GitFileChange[]): GitChangeRow[] => [
  ...conflicts.map((conflict) => ({ key: rowKey(GitRowGroup.Conflict, conflict.path), group: GitRowGroup.Conflict, conflict })),
  ...unstaged.map((change) => ({ key: rowKey(GitRowGroup.Unstaged, change.path), group: GitRowGroup.Unstaged, change })),
  ...staged.map((change) => ({ key: rowKey(GitRowGroup.Staged, change.path), group: GitRowGroup.Staged, change })),
]

export const openChangeRow = (row: GitChangeRow): void => {
  if (row.conflict) {
    openInEditor(row.conflict.path)
  } else if (row.change) {
    showChange(row.change, row.group === GitRowGroup.Staged ? GitDiffSource.Staged : GitDiffSource.Unstaged)
  }
}
