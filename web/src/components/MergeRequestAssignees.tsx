import type { ForgeUser } from '../bridge/forgeMessages'
import { initials } from '../git/gitLabels'

interface MergeRequestAssigneesProps {
  users: ForgeUser[]
}

const VISIBLE_ASSIGNEES = 2

export function MergeRequestAssignees({ users }: MergeRequestAssigneesProps) {
  const hidden = users.length - VISIBLE_ASSIGNEES

  return (
    <span className="ml-auto flex shrink-0 items-center gap-[2px]" data-tip={`Assignée à ${users.map((user) => user.name).join(', ')}`}>
      {users.slice(0, VISIBLE_ASSIGNEES).map((user) => (
        <span key={user.login} className="flex size-[18px] items-center justify-center rounded-full bg-tily-line text-[11px] font-semibold text-tily-ink-soft">
          {initials(user.name)}
        </span>
      ))}
      {hidden > 0 && <span className="text-tily-muted">{`+${hidden}`}</span>}
    </span>
  )
}
