import type { ReactNode } from 'react'
import { SECTION_TITLE } from './rightPanelStyles'

interface GitGroupHeaderProps {
  title: string
  count?: number
  children?: ReactNode
}

export function GitGroupHeader({ title, count, children }: GitGroupHeaderProps) {
  return (
    <div className="flex h-[26px] shrink-0 items-center gap-[6px] pr-[4px] pl-[12px]">
      <span className={SECTION_TITLE}>
        {title}
      </span>
      {count !== undefined && <span className="text-[11px] text-tily-muted">{count}</span>}
      <span className="flex-1" />
      {children}
    </div>
  )
}
