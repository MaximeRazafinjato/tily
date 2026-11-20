import { useState } from 'react'
import type { GitRefLabel } from '../bridge/gitMessages'
import { refLabelText } from '../git/gitLabels'
import { GRAPH_ROW_HEIGHT, laneStroke, type GitGraphRowHandlers } from './gitGraphStyles'
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
  const [expanded, setExpanded] = useState(false)
  const expandable = hidden.length > 0

  const handlePointerEnter = () => setExpanded(expandable)
  const handlePointerLeave = () => setExpanded(false)

  return (
    <div className="relative h-full shrink-0" style={{ width }} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <div className="flex h-full items-center gap-[4px] overflow-hidden pl-[6px]">
        {first && <GitRefPill label={first} text={refLabelText(first, remotes)} color={color} onMenu={handlers.openLabelMenu} onActivate={handlers.activateLabel} />}
        {expandable && <span className={`shrink-0 rounded px-[4px] text-[11px] ${expanded ? 'bg-tily-green-soft text-tily-ink' : 'bg-tily-paper text-tily-muted'}`}>{`+${hidden.length}`}</span>}
        {first && (
          <svg className="h-full min-w-[6px] flex-1" aria-hidden="true">
            <line x1={0} x2="100%" y1={GRAPH_ROW_HEIGHT / 2} y2={GRAPH_ROW_HEIGHT / 2} strokeWidth={1.5} className={laneStroke(color)} />
          </svg>
        )}
      </div>
      {expanded && (
        <div className="absolute top-full left-px z-20 -mt-[4px] flex w-max max-w-[360px] flex-col items-start gap-[2px] rounded-md border border-tily-line bg-tily-panel p-1 shadow-lg">
          {hidden.map((label) => (
            <div key={`${label.kind}:${label.name}`} className="flex h-[22px] max-w-full items-center">
              <GitRefPill label={label} text={refLabelText(label, remotes)} color={color} onMenu={handlers.openLabelMenu} onActivate={handlers.activateLabel} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
