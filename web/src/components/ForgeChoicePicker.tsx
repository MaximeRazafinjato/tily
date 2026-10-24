import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
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

const colorDot = (color: string | undefined) => color && <span className="size-[8px] shrink-0 rounded-full" style={{ backgroundColor: color }} />

export function ForgeChoicePicker({ label, options, selected, multiple, emptyMessage, disabled = false, onToggle }: ForgeChoicePickerProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
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
    popupRef.current?.scrollIntoView({ block: 'nearest' })
    return () => document.removeEventListener('pointerdown', handlePointerDown)
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
              <Icon name={IconName.Close} size={9} />
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
          <Icon name={multiple || selected.length === 0 ? IconName.Plus : IconName.Pencil} size={9} />
          {multiple || selected.length === 0 ? 'Ajouter' : 'Changer'}
        </button>
      </div>
      {open && (
        <div ref={popupRef} className="flex w-[320px] max-w-full flex-col gap-1 rounded-md border border-tily-line bg-tily-panel p-1 shadow-lg">
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
          <div ref={listRef} role="listbox" aria-label={label} aria-multiselectable={multiple} className="max-h-[min(40vh,260px)] overflow-y-auto">
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
