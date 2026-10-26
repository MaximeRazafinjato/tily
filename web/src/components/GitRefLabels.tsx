import type { GitRefLabel } from '../bridge/gitMessages'
import { refLabelText } from '../git/gitLabels'
import { laneBar, type GitGraphRowHandlers } from './gitGraphStyles'
import { GitRefPill } from './GitRefPill'

interface GitRefLabelsProps {
  refs: GitRefLabel[]
  color: number
  width: number
  remotes: string[]
  handlers: GitGraphRowHandlers
}

export function GitRefLabels({ refs, color, width, remotes, handlers }: GitRefLabelsProps) {
  const [first, ...hidden] = refs

  return (
    <div className="flex h-full shrink-0 items-center gap-[4px] overflow-hidden pl-[6px]" style={{ width }}>
      {first && <GitRefPill label={first} text={refLabelText(first, remotes)} color={color} onMenu={handlers.openLabelMenu} onActivate={handlers.activateLabel} />}
      {hidden.length > 0 && (
        <span className="shrink-0 rounded bg-tily-paper px-[4px] text-[11px] text-tily-muted" data-tip={hidden.map((label) => refLabelText(label, remotes)).join(', ')}>
          {`+${hidden.length}`}
        </span>
      )}
      {first && <span className={`h-[1.5px] min-w-[6px] flex-1 ${laneBar(color)}`} />}
    </div>
  )
}
