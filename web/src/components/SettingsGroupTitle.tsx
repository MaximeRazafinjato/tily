import { Icon } from './Icon'
import { IconName } from './iconName'

interface SettingsGroupTitleProps {
  title: string
  expanded?: boolean
  onToggle?: () => void
}

const GROUP_TITLE = 'col-span-2 mt-3 flex items-center gap-1.5 border-b border-tily-line pb-1 text-[11px] font-semibold tracking-wide text-tily-muted uppercase'

export function SettingsGroupTitle({ title, expanded, onToggle }: SettingsGroupTitleProps) {
  if (!onToggle) {
    return <h4 className={GROUP_TITLE}>{title}</h4>
  }
  return (
    <h4 className={GROUP_TITLE}>
      <button type="button" aria-expanded={expanded} className="flex cursor-pointer items-center gap-1.5 uppercase hover:text-tily-ink" onClick={onToggle}>
        <Icon name={IconName.Chevron} size={10} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        {title}
      </button>
    </h4>
  )
}
