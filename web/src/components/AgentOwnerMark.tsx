import { OWNER_LABEL, ownerTip } from '../agents/agentOwnership'
import { useSessionStore } from '../store/sessionStore'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface AgentOwnerMarkProps {
  owner: string
}

const ICON_SIZE = 10

export function AgentOwnerMark({ owner }: AgentOwnerMarkProps) {
  const tip = useSessionStore((state) => ownerTip(state.session, owner))
  return (
    <span className="shrink-0 text-tily-muted" data-tip={tip} aria-label={OWNER_LABEL}>
      <Icon name={IconName.Agent} size={ICON_SIZE} />
    </span>
  )
}
