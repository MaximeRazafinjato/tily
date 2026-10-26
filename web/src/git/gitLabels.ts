import { GitChangeKind, GitConflictKind, GitOperationKind, GitRefKind, type GitHead, type GitRefLabel, type GitState } from '../bridge/gitMessages'

export const CHANGE_LETTERS: Record<GitChangeKind, string> = {
  [GitChangeKind.Modified]: 'M',
  [GitChangeKind.Added]: 'A',
  [GitChangeKind.Deleted]: 'D',
  [GitChangeKind.Renamed]: 'R',
  [GitChangeKind.Copied]: 'C',
  [GitChangeKind.TypeChanged]: 'T',
  [GitChangeKind.Untracked]: 'U',
}

export const CHANGE_LABELS: Record<GitChangeKind, string> = {
  [GitChangeKind.Modified]: 'Modifié',
  [GitChangeKind.Added]: 'Ajouté',
  [GitChangeKind.Deleted]: 'Supprimé',
  [GitChangeKind.Renamed]: 'Renommé',
  [GitChangeKind.Copied]: 'Copié',
  [GitChangeKind.TypeChanged]: 'Type modifié',
  [GitChangeKind.Untracked]: 'Non suivi',
}

export const CHANGE_CLASSES: Record<GitChangeKind, string> = {
  [GitChangeKind.Modified]: 'text-tily-warning',
  [GitChangeKind.Added]: 'text-tily-green',
  [GitChangeKind.Deleted]: 'text-tily-error',
  [GitChangeKind.Renamed]: 'text-tily-lane-1',
  [GitChangeKind.Copied]: 'text-tily-lane-1',
  [GitChangeKind.TypeChanged]: 'text-tily-lane-3',
  [GitChangeKind.Untracked]: 'text-tily-green',
}

export const CONFLICT_LABELS: Record<GitConflictKind, string> = {
  [GitConflictKind.BothModified]: 'Modifié des deux côtés',
  [GitConflictKind.BothAdded]: 'Ajouté des deux côtés',
  [GitConflictKind.BothDeleted]: 'Supprimé des deux côtés',
  [GitConflictKind.AddedByUs]: 'Ajouté de notre côté',
  [GitConflictKind.AddedByThem]: 'Ajouté de leur côté',
  [GitConflictKind.DeletedByUs]: 'Supprimé de notre côté',
  [GitConflictKind.DeletedByThem]: 'Supprimé de leur côté',
}

export const OPERATION_LABELS: Record<GitOperationKind, string> = {
  [GitOperationKind.Merge]: 'Merge',
  [GitOperationKind.Rebase]: 'Rebase',
  [GitOperationKind.CherryPick]: 'Cherry-pick',
  [GitOperationKind.Revert]: 'Revert',
}

const SECONDS_PER_DAY = 86400
const RELATIVE_DAYS = 7
const relativeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const shortRelativeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto', style: 'short' })
const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', RELATIVE_DAYS],
]

export const shortSha = (sha: string | undefined): string => (sha ?? '').slice(0, 7)

export const fileName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

export const fileFolder = (path: string): string => path.slice(0, Math.max(path.lastIndexOf('/'), 0))

export const plural = (count: number, singular: string, several: string): string => `${count} ${count > 1 ? several : singular}`

export const currentName = (head: GitHead): string => head.branch ?? 'HEAD'

export const headSummary = (head: GitHead): string => {
  if (head.detached) {
    return `HEAD détachée sur ${shortSha(head.sha)}`
  }
  return head.unborn ? `${head.branch ?? 'main'} · aucun commit` : (head.branch ?? 'HEAD')
}

export const relativeDate = (unixSeconds: number, short = false): string => {
  const format = short ? shortRelativeFormat : relativeFormat
  const now = Date.now() / 1000
  let delta = unixSeconds - now
  if (Math.abs(delta) >= SECONDS_PER_DAY * RELATIVE_DAYS) {
    const date = new Date(unixSeconds * 1000)
    const sameYear = date.getFullYear() === new Date().getFullYear()
    return date.toLocaleDateString('fr-FR', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
  }
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(delta) < size) {
      return format.format(Math.round(delta), unit)
    }
    delta /= size
  }
  return format.format(Math.round(delta), 'week')
}

export const fullDate = (unixSeconds: number): string => new Date(unixSeconds * 1000).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

export const shortDate = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')

export const initials = (author: string): string => {
  const words = author.split(/[\s._-]+/).filter((word) => word.length > 0)
  const letters = words.length > 1 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

const remoteBranchName = (name: string, remotes: string[]): string => {
  const remote = remotes.filter((candidate) => name.startsWith(`${candidate}/`)).sort((left, right) => right.length - left.length)[0]
  return remote ? name.slice(remote.length + 1) : name
}

export const refLabelText = (label: GitRefLabel, remotes: string[]): string => (label.kind === GitRefKind.Remote ? remoteBranchName(label.name, remotes) : label.name)

export const refLabelTip = (label: GitRefLabel): string => {
  switch (label.kind) {
    case GitRefKind.Head:
      return 'HEAD détachée'
    case GitRefKind.Tag:
      return `Tag ${label.name}`
    case GitRefKind.Remote:
      return `Branche distante ${label.name}`
    default:
      return `${label.current ? 'Branche courante' : 'Branche locale'} ${label.name}${label.remotes.length > 0 ? ` · à jour avec ${label.remotes.join(', ')}` : ''}`
  }
}

export interface WorkingTreeCounts {
  modified: number
  added: number
  deleted: number
  conflicts: number
}

export const workingTreeCounts = (state: GitState): WorkingTreeCounts => {
  const kinds = new Map([...state.staged, ...state.unstaged].map((change) => [change.path, change.kind]))
  const values = [...kinds.values()]
  return {
    modified: values.filter((kind) => kind !== GitChangeKind.Added && kind !== GitChangeKind.Untracked && kind !== GitChangeKind.Deleted).length,
    added: values.filter((kind) => kind === GitChangeKind.Added || kind === GitChangeKind.Untracked).length,
    deleted: values.filter((kind) => kind === GitChangeKind.Deleted).length,
    conflicts: state.conflicts.length,
  }
}

export const absolutePath = (root: string, path: string): string => `${root.replace(/[\\/]+$/, '')}\\${path.replaceAll('/', '\\')}`
