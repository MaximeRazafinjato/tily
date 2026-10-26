import { refIndent } from '../git/gitBranchTree'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface GitRefFolderProps {
  name: string
  path: string
  count: number
  depth: number
  expanded: boolean
  onToggle: () => void
}

export function GitRefFolder({ name, path, count, depth, expanded, onToggle }: GitRefFolderProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      className="flex h-[24px] w-full shrink-0 cursor-pointer items-center gap-[6px] pr-[8px] text-left text-[12px] text-tily-muted select-none hover:bg-tily-green-hover hover:text-tily-ink"
      style={{ paddingLeft: refIndent(depth) }}
      data-tip={`${path}/ · ${expanded ? 'replier' : 'déplier'}`}
      onClick={onToggle}
    >
      <span className="flex shrink-0 translate-y-px">
        <Icon name={IconName.Chevron} size={10} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </span>
      <Icon name={IconName.Folder} className="shrink-0 translate-y-px" />
      <span className="flex min-w-0 items-baseline gap-[6px]">
        <span className="min-w-0 truncate">{name}</span>
        <span className="shrink-0 text-[11px]">{count}</span>
      </span>
    </button>
  )
}
