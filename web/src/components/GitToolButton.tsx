import { Icon } from './Icon'
import type { IconName } from './iconName'

interface GitToolButtonProps {
  icon: IconName
  tip: string
  label?: string
  disabled?: boolean
  pressed?: boolean
  labelClassName?: string
  iconClassName?: string
  onClick: () => void
}

export function GitToolButton({ icon, tip, label, disabled = false, pressed, labelClassName = '', iconClassName, onClick }: GitToolButtonProps) {
  const handleClick = () => {
    if (!disabled) {
      onClick()
    }
  }

  return (
    <button
      type="button"
      aria-label={label ?? tip}
      aria-disabled={disabled}
      aria-pressed={pressed}
      data-tip={tip}
      className="flex h-[24px] shrink-0 items-center gap-[5px] rounded-md px-[6px] text-[12px] text-tily-ink-soft hover:bg-tily-green-hover hover:text-tily-ink aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-tily-ink-soft aria-pressed:bg-tily-green-soft aria-pressed:text-tily-green-deep"
      onClick={handleClick}
    >
      <Icon name={icon} className={iconClassName} />
      {label && <span className={`whitespace-nowrap ${labelClassName}`}>{label}</span>}
    </button>
  )
}
