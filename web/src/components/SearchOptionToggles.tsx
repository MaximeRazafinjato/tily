import { SearchOption, type SearchOptions } from '../model/textSearch'

interface SearchOptionTogglesProps {
  options: SearchOptions
  onToggle: (option: SearchOption) => void
}

interface ToggleDescription {
  option: SearchOption
  text: string
  label: string
  keys: string
}

const TOGGLES: ToggleDescription[] = [
  { option: SearchOption.CaseSensitive, text: 'Aa', label: 'Respecter la casse', keys: 'Alt + C' },
  { option: SearchOption.WholeWord, text: 'ab', label: 'Mot entier', keys: 'Alt + W' },
  { option: SearchOption.Regex, text: '.*', label: 'Expression régulière', keys: 'Alt + R' },
]

const TOGGLE_BUTTON = 'flex h-5 min-w-5 shrink-0 cursor-pointer items-center justify-center rounded px-1 font-mono text-[11px] leading-none focus:outline-none'
const ACTIVE_TOGGLE = 'bg-tily-green-soft text-tily-green-deep ring-1 ring-tily-green'
const INACTIVE_TOGGLE = 'text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink'

const handleTogglePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => event.preventDefault()

export function SearchOptionToggles({ options, onToggle }: SearchOptionTogglesProps) {
  return (
    <>
      {TOGGLES.map(({ option, text, label, keys }) => {
        const handleClick = () => onToggle(option)
        return (
          <button
            key={option}
            type="button"
            tabIndex={-1}
            aria-pressed={options[option]}
            aria-label={label}
            data-tip={`${label} (${keys})`}
            className={`${TOGGLE_BUTTON} ${options[option] ? ACTIVE_TOGGLE : INACTIVE_TOGGLE}`}
            onPointerDown={handleTogglePointerDown}
            onClick={handleClick}
          >
            {text}
          </button>
        )
      })}
    </>
  )
}
