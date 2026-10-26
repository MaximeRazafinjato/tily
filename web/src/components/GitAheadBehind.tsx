interface GitAheadBehindProps {
  ahead: number
  behind: number
  tip?: string
}

export function GitAheadBehind({ ahead, behind, tip }: GitAheadBehindProps) {
  return (
    <span className="flex shrink-0 gap-[4px] text-[11px]" data-tip={tip}>
      <span className={ahead > 0 ? 'text-tily-diff-added-ink' : 'text-tily-muted'}>{`↑${ahead}`}</span>
      <span className={behind > 0 ? 'text-tily-diff-removed-ink' : 'text-tily-muted'}>{`↓${behind}`}</span>
    </span>
  )
}
