import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { isPaneSearchShortcut } from '../keyboard/shortcuts'
import { useTerminalSearchStore } from '../store/terminalSearchStore'
import { openGlobalSearch } from '../terminal/globalSearch'
import { changeSearchQuery, closePaneSearch, findInPane, isQueryValid, SearchDirection, searchOptionOf, searchResultLabel, toggleSearchOption } from '../terminal/paneSearch'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SearchOptionToggles } from './SearchOptionToggles'

const BAR_BUTTON = 'flex h-5 min-w-5 shrink-0 cursor-pointer items-center justify-center rounded px-1 text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink focus:outline-none'

const handleButtonPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => event.preventDefault()
const handlePrevious = () => findInPane(SearchDirection.Previous)
const handleNext = () => findInPane(SearchDirection.Next)
const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => changeSearchQuery(event.target.value)

export function PaneSearchBar() {
  const { query, options, results, focusRequest } = useTerminalSearchStore(
    useShallow((state) => ({ query: state.query, options: state.options, results: state.results, focusRequest: state.focusRequest })),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusRequest])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return
    }
    const option = searchOptionOf(event)
    if (option) {
      event.preventDefault()
      toggleSearchOption(option)
    } else if (event.key === 'Enter' && event.altKey) {
      event.preventDefault()
      openGlobalSearch()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      findInPane(event.shiftKey ? SearchDirection.Next : SearchDirection.Previous)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closePaneSearch()
    } else if (isPaneSearchShortcut(event.nativeEvent)) {
      event.preventDefault()
      inputRef.current?.select()
    }
  }

  const label = searchResultLabel(query, options, results)
  const valid = isQueryValid(query, options)

  return (
    <div role="search" aria-label="Rechercher dans le terminal" className="absolute top-1 right-3 z-10 flex items-center gap-1 rounded-md border border-tily-line bg-tily-panel px-1.5 py-1 text-[12px] shadow-lg">
      <input
        ref={inputRef}
        type="text"
        aria-label="Texte recherché"
        aria-invalid={!valid}
        placeholder="Rechercher"
        value={query}
        spellCheck={false}
        className={`w-44 rounded border bg-tily-paper px-2 py-0.5 text-tily-ink outline-none placeholder:text-tily-muted ${valid ? 'border-tily-line focus:border-tily-focus' : 'border-tily-error'}`}
        onChange={handleQueryChange}
        onKeyDown={handleKeyDown}
      />
      <SearchOptionToggles options={options} onToggle={toggleSearchOption} />
      <span role="status" className={`min-w-16 px-1 text-center text-[11px] whitespace-nowrap ${valid ? 'text-tily-muted' : 'text-tily-error'}`}>
        {label}
      </span>
      <button type="button" tabIndex={-1} className={BAR_BUTTON} aria-label="Occurrence précédente" data-tip="Occurrence précédente, vers le haut (Entrée)" onPointerDown={handleButtonPointerDown} onClick={handlePrevious}>
        <Icon name={IconName.Chevron} size={10} className="-rotate-90" />
      </button>
      <button type="button" tabIndex={-1} className={BAR_BUTTON} aria-label="Occurrence suivante" data-tip="Occurrence suivante, vers le bas (Maj + Entrée)" onPointerDown={handleButtonPointerDown} onClick={handleNext}>
        <Icon name={IconName.Chevron} size={10} className="rotate-90" />
      </button>
      <button type="button" tabIndex={-1} className={`${BAR_BUTTON} text-[11px]`} aria-label="Chercher dans tous les terminaux" data-tip="Chercher dans tous les terminaux (Alt + Entrée)" onPointerDown={handleButtonPointerDown} onClick={openGlobalSearch}>
        Tous
      </button>
      <button type="button" tabIndex={-1} className={`${BAR_BUTTON} hover:text-tily-error`} aria-label="Fermer la recherche" data-tip="Fermer la recherche (Échap)" onPointerDown={handleButtonPointerDown} onClick={closePaneSearch}>
        <Icon name={IconName.Close} size={10} />
      </button>
    </div>
  )
}
