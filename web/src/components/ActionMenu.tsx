import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface ActionMenuItem {
  id: string
  label: string
  detail?: ReactNode
  disabled?: boolean
  run: () => void
}

interface ActionMenuProps {
  label: string
  items: ActionMenuItem[]
  emptyMessage?: string
  header?: ReactNode
  align?: 'left' | 'right'
  scrollable?: boolean
  onClose: () => void
}

const itemsOf = (menu: HTMLDivElement | null): HTMLButtonElement[] => Array.from(menu?.querySelectorAll('button:not(:disabled)') ?? [])

export function ActionMenu({ label, items, emptyMessage, header, align = 'left', scrollable = false, onClose }: ActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const menu = menuRef.current
    itemsOf(menu)[0]?.focus()
    const handleOutside = (event: PointerEvent) => {
      if (!menu?.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [onClose])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const focusable = itemsOf(menuRef.current)
    const index = focusable.findIndex((item) => item === document.activeElement)
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: focusable.length - 1 }
    if (event.key in moves) {
      event.preventDefault()
      event.stopPropagation()
      focusable[(moves[event.key] + focusable.length) % focusable.length]?.focus()
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      className={`absolute top-full z-20 mt-1 w-max max-w-[360px] min-w-[190px] rounded-md border border-tily-line bg-tily-panel p-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'} ${scrollable ? 'max-h-[min(50vh,360px)] overflow-y-auto' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {header}
      {items.length === 0 && emptyMessage && <span className="block px-3 py-2 text-[11px] text-tily-muted">{emptyMessage}</span>}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          tabIndex={-1}
          disabled={item.disabled}
          className="flex w-full cursor-pointer items-baseline gap-3 rounded px-3 py-2 text-left text-[12px] text-tily-ink hover:bg-tily-green-hover focus:bg-tily-green-soft focus:text-tily-green-deep focus:outline-none disabled:cursor-default disabled:text-tily-muted disabled:opacity-60 disabled:hover:bg-transparent"
          onClick={item.run}
        >
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.detail}
        </button>
      ))}
    </div>
  )
}
