import { useCallback, useRef, useState } from 'react'
import { ActionMenu, type ActionMenuItem } from './ActionMenu'
import { Icon } from './Icon'
import { IconName } from './iconName'

export interface FacetOption {
  id: string
  label: string
}

interface MergeRequestFacetButtonProps {
  label: string
  options: FacetOption[]
  selected: string[]
  emptyMessage: string
  onToggle: (id: string) => void
}

export function MergeRequestFacetButton({ label, options, selected, emptyMessage, onToggle }: MergeRequestFacetButtonProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const openAtPressRef = useRef(false)
  const handlePointerDown = () => {
    openAtPressRef.current = open
  }
  const handleClick = () => {
    if (!openAtPressRef.current) {
      setOpen(true)
    }
    openAtPressRef.current = false
  }
  const handleClose = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus()
  }, [])
  const items: ActionMenuItem[] = options.map((option) => ({
    id: option.id,
    label: option.label,
    detail: selected.includes(option.id) ? <Icon name={IconName.Check} className="shrink-0 self-center text-tily-green-deep" /> : <span className="size-[12px] shrink-0 self-center" />,
    run: () => onToggle(option.id),
  }))
  const count = selected.length

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-[24px] cursor-pointer items-center gap-[4px] rounded border px-[6px] text-[11px] hover:bg-tily-green-hover ${count > 0 ? 'border-tily-green text-tily-green-deep' : 'border-tily-line text-tily-ink-soft'}`}
        data-tip={count > 0 ? `${label} : ${selected.join(', ')} (au moins un)` : `Filtrer par ${label.toLowerCase()}`}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <span>{count > 0 ? `${label} · ${count}` : label}</span>
        <Icon name={IconName.Chevron} size={10} className="rotate-90" />
      </button>
      {open && <ActionMenu label={`Filtrer par ${label.toLowerCase()}`} items={items} emptyMessage={emptyMessage} scrollable onClose={handleClose} />}
    </div>
  )
}
