import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface GitSectionProps {
  title: string
  count: number
  expanded: boolean
  nested?: boolean
  empty?: string
  actions?: ReactNode
  onToggle: () => void
  children: ReactNode
}

export function GitSection({ title, count, expanded, nested = false, empty, actions, onToggle, children }: GitSectionProps) {
  return (
    <div className="flex flex-col">
      <div className={`flex h-[26px] shrink-0 items-center gap-[4px] pr-[4px] ${nested ? 'pl-[16px]' : 'pl-[6px]'}`}>
        <button
          type="button"
          aria-expanded={expanded}
          className={`flex min-w-0 flex-1 cursor-pointer items-center gap-[4px] rounded text-left ${nested ? 'text-[12px] text-tily-ink-soft' : 'text-[11px] font-semibold tracking-[0.06em] text-tily-muted uppercase'} hover:text-tily-ink`}
          onClick={onToggle}
        >
          <Icon name={IconName.Chevron} size={10} className={`shrink-0 transition-transform ${nested ? '' : 'translate-y-[0.5px]'} ${expanded ? 'rotate-90' : ''}`} />
          <span className="truncate">{title}</span>
          <span className="shrink-0 text-[11px] font-normal tracking-normal text-tily-muted normal-case">{count}</span>
        </button>
        {actions}
      </div>
      {expanded && (count === 0 && empty ? <p className={`py-[2px] text-[12px] text-tily-muted italic ${nested ? 'pl-[30px]' : 'pl-[20px]'}`}>{empty}</p> : children)}
    </div>
  )
}
