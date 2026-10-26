import { Icon } from './Icon'
import { IconName } from './iconName'

interface EditableNameProps {
  name: string
  className: string
  onClick: (event: React.MouseEvent) => void
}

export function EditableName({ name, className, onClick }: EditableNameProps) {
  return (
    <button type="button" className={`group flex min-w-0 cursor-pointer items-center gap-1.5 rounded px-1.5 text-left hover:bg-tily-line hover:text-tily-ink ${className}`} data-tip="Renommer le workspace" onClick={onClick}>
      <span className="truncate">{name}</span>
      <Icon name={IconName.Pencil} className="shrink-0 translate-y-px text-tily-muted opacity-60 transition-opacity group-hover:text-tily-green-deep group-hover:opacity-100" />
    </button>
  )
}
