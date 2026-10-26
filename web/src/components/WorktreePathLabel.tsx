import { folderName } from '../model/session'
import { parentFolder } from '../worktree/worktreePaths'

interface WorktreePathLabelProps {
  path: string
}

export function WorktreePathLabel({ path }: WorktreePathLabelProps) {
  return (
    <span className="flex min-w-0 flex-1 items-baseline gap-2 text-[12px]" data-tip={path || undefined}>
      <span className="shrink-0 text-tily-ink">{path ? folderName(path) : '—'}</span>
      <span className="truncate text-[11px] text-tily-muted">{parentFolder(path)}</span>
    </span>
  )
}
