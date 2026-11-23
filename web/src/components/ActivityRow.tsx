import type { ReactNode } from 'react'
import { formatUsage, type Usage } from '../activity/activityView'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface ActivityRowProps {
  label: ReactNode
  usage: Usage
  share: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function ActivityRow({ label, usage, share, open, onToggle, children }: ActivityRowProps) {
  return (
    <div>
      <button type="button" aria-expanded={open} className="flex w-full cursor-pointer items-center gap-[6px] rounded-md px-[4px] py-[3px] text-left text-[12px] text-tily-ink hover:bg-tily-green-hover" onClick={onToggle}>
        <Icon name={IconName.Chevron} size={10} className={`shrink-0 transition-transform duration-[120ms] ease-out ${open ? 'rotate-90' : ''}`} />
        <span className="flex min-w-0 flex-1 items-center gap-[6px] truncate">{label}</span>
        <span className="shrink-0 text-tily-muted tabular-nums">{formatUsage(usage)}</span>
      </button>
      <div className="mx-[4px] mb-[3px] ml-[20px] h-[2px] overflow-hidden rounded-[1px] bg-tily-line">
        <div className="h-full bg-tily-green" style={{ width: `${share}%` }} />
      </div>
      {open && <div className="pb-[6px] pl-[20px] text-[11px]">{children}</div>}
    </div>
  )
}
