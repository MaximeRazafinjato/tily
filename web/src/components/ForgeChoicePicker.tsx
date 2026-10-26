import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ChangeEvent, type KeyboardEvent } from 'react'
import { filterOptions, optionLabel, type ChoiceOption } from '../forge/mergeRequestFormOptions'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SETTINGS_INPUT, SETTINGS_LABEL } from './settingsStyles'

interface ForgeChoicePickerProps {
  label: string
  options: ChoiceOption[]
  selected: string[]
  multiple: boolean
  emptyMessage: string
  disabled?: boolean
  onToggle: (id: string) => void
}

const CHIP = 'flex max-w-[220px] items-center gap-[4px] rounded border border-tily-line bg-tily-paper py-[1px] pr-[2px] pl-[6px] text-[11px] text-tily-ink'

const POPUP_WIDTH = 320
const POPUP_MARGIN = 8
const POPUP_GAP = 4
const SEARCH_HEIGHT = 40
const LIST_MAX_HEIGHT = 260
const LIST_MIN_HEIGHT = 120

interface PopupAnchor {
  left: number
  top: number
  bottom: number
}

interface PopupPlacement {
  style: CSSProperties
  listHeight: number
}

const popupPlacement = (anchor: PopupAnchor): PopupPlacement => {
  const below = window.innerHeight - anchor.bottom - POPUP_GAP - POPUP_MARGIN
  const above = anchor.top - POPUP_GAP - POPUP_MARGIN
  const upward = below < LIST_MIN_HEIGHT + SEARCH_HEIGHT && above > below
  const room = (upward ? above : below) - SEARCH_HEIGHT
  const left = Math.max(POPUP_MARGIN, Math.min(anchor.left, window.innerWidth - POPUP_WIDTH - POPUP_MARGIN))
  return {
    style: upward ? { left, bottom: window.innerHeight - anchor.top + POPUP_GAP } : { left, top: anchor.bottom + POPUP_GAP },
    listHeight: Math.max(LIST_MIN_HEIGHT, Math.min(LIST_MAX_HEIGHT, room)),
  }
}

const colorDot = (color: string | undefined) => color && <span className="size-[8px] shrink-0 rounded-full" style={{ backgroundColor: color }} />

export function ForgeChoicePicker({ label, options, selected, multiple, emptyMessage, disabled = false, onToggle }: ForgeChoicePickerProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<PopupPlacement | null>(null)
  const visible = filterOptions(options, text)
  const activeIndex = Math.min(active, Math.max(visible.length - 1, 0))

  useEffect(() => {
    if (!open) {
      return
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useLayoutEffect(() => {
    if (!open) {
      return
    }
    const field = rootRef.current?.getBoundingClientRect()
    const button = buttonRef.current?.getBoundingClientRect()
    if (!field || !button) {
      return
    }
    const topOffset = button.top - field.top
    const bottomOffset = button.bottom - field.top
    const place = () => {
      const current = rootRef.current?.getBoundingClientRect()
      if (current) {
        setPlacement(popupPlacement({ left: current.left, top: current.top + topOffset, bottom: current.top + bottomOffset }))
      }
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }
  const choose = (id: string) => {
    onToggle(id)
    if (!multiple) {
      close()
    }
  }
  const handleOpen = () => {
    setText('')
    setActive(0)
    setOpen(!open)
  }
  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value)
    setActive(0)
  }
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + step + visible.length) % Math.max(visible.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = visible[activeIndex]
      if (option) {
        choose(option.id)
      }
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-1">
      <span className={SETTINGS_LABEL}>{label}</span>
      <div className="flex flex-wrap items-center gap-[4px]">
        {selected.map((id) => (
          <span key={id} className={CHIP}>
            {colorDot(options.find((option) => option.id === id)?.color)}
            <span className="truncate">{optionLabel(options, id)}</span>
            <button type="button" className="cursor-pointer rounded p-[1px] text-tily-muted hover:text-tily-ink" aria-label={`Retirer ${optionLabel(options, id)}`} disabled={disabled} onClick={() => onToggle(id)}>
              <Icon name={IconName.Close} size={9} className="translate-y-[0.5px]" />
            </button>
          </span>
        ))}
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          className="flex h-[22px] cursor-pointer items-center gap-[4px] rounded border border-dashed border-tily-line px-[6px] text-[11px] text-tily-ink-soft hover:bg-tily-green-hover disabled:cursor-default disabled:opacity-50"
          onClick={handleOpen}
        >
          <Icon name={multiple || selected.length === 0 ? IconName.Plus : IconName.Pencil} size={9} className="translate-y-[0.5px]" />
          {multiple || selected.length === 0 ? 'Ajouter' : 'Changer'}
        </button>
      </div>
      {open && placement && (
        <div className="fixed z-40 flex flex-col gap-1 rounded-md border border-tily-line bg-tily-panel p-1 shadow-lg" style={{ ...placement.style, width: POPUP_WIDTH }}>
          <input
            type="text"
            className={SETTINGS_INPUT}
            value={text}
            placeholder="Rechercher…"
            spellCheck={false}
            autoFocus
            role="combobox"
            aria-expanded
            aria-label={`Rechercher : ${label.toLowerCase()}`}
            onChange={handleTextChange}
            onKeyDown={handleSearchKeyDown}
          />
          <div ref={listRef} role="listbox" aria-label={label} aria-multiselectable={multiple} className="overflow-y-auto" style={{ maxHeight: placement.listHeight }}>
            {visible.length === 0 && <span className="block px-3 py-2 text-xs text-tily-muted">{options.length === 0 ? emptyMessage : 'Aucun résultat.'}</span>}
            {visible.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="option"
                tabIndex={-1}
                data-index={index}
                aria-selected={selected.includes(option.id)}
                className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-[5px] text-left text-xs text-tily-ink hover:bg-tily-green-hover ${index === activeIndex ? 'bg-tily-green-soft' : ''}`}
                onPointerEnter={() => setActive(index)}
                onClick={() => choose(option.id)}
              >
                {selected.includes(option.id) ? <Icon name={IconName.Check} className="shrink-0 text-tily-green-deep" /> : <span className="size-[12px] shrink-0" />}
                {colorDot(option.color)}
                <span className="min-w-0 truncate">{option.label}</span>
                {option.hint && <span className="ml-auto min-w-0 shrink truncate pl-2 text-[11px] text-tily-muted">{option.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
