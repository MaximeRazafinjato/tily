import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTerminalSearchStore } from '../store/terminalSearchStore'
import { closeGlobalSearch, collectTerminalLines, findTerminalLines, goToTerminalLine, matchPartsOf } from '../terminal/globalSearch'
import { changeSearchQuery, isQueryValid, searchOptionOf, toggleSearchOption } from '../terminal/paneSearch'
import { keepTabInside } from './focusTrap'
import { SearchOptionToggles } from './SearchOptionToggles'

const MAX_RESULTS = 300
const RESULT_ID_PREFIX = 'terminal-search-result-'
const LISTBOX_ID = 'terminal-search-results'

const handleResultPointerDown = (event: PointerEvent<HTMLButtonElement>) => event.preventDefault()

const footerOf = (total: number, panes: number, shown: number): string => {
  if (total === 0) {
    return 'Entrée : afficher la ligne dans son terminal'
  }
  const lines = total === 1 ? '1 ligne' : `${total} lignes`
  const terminals = panes === 1 ? '1 terminal' : `${panes} terminaux`
  const hidden = total > shown ? ` (${shown} affichées : précisez la recherche)` : ''
  return `${lines} dans ${terminals}${hidden} · Entrée : afficher la ligne dans son terminal`
}

export function TerminalSearchDialog() {
  const { open, query, options } = useTerminalSearchStore(useShallow((state) => ({ open: state.globalOpen, query: state.query, options: state.options })))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lines = useMemo(() => (open ? collectTerminalLines() : []), [open])
  const { matches, total, panes } = useMemo(() => findTerminalLines(lines, query, options, MAX_RESULTS), [lines, query, options])
  const selected = Math.max(0, matches.findIndex((line) => line.id === selectedId))
  const selectedLine = matches[selected]

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`#${RESULT_ID_PREFIX}${selected}`)?.scrollIntoView({ block: 'nearest' })
  }, [selected, matches])

  useEffect(() => {
    if (open) {
      inputRef.current?.select()
    }
  }, [open])

  if (!open) {
    return null
  }

  const valid = isQueryValid(query, options)
  const move = (offset: number) => {
    if (matches.length > 0) {
      setSelectedId(matches[(selected + offset + matches.length) % matches.length].id)
    }
  }
  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    changeSearchQuery(event.target.value)
    setSelectedId(null)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return
    }
    const option = searchOptionOf(event)
    if (option) {
      event.preventDefault()
      toggleSearchOption(option)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (selectedLine) {
        goToTerminalLine(selectedLine)
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeGlobalSearch()
    }
  }
  const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeGlobalSearch()
    }
  }
  const emptyMessage = !valid ? 'Expression invalide.' : query === '' ? 'Tapez le texte à chercher dans tous les terminaux.' : 'Aucune ligne ne correspond dans les terminaux ouverts.'

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-tily-paper/60 pt-[12vh]" onPointerDown={handleBackdropPointerDown}>
      <div role="dialog" aria-label="Rechercher dans tous les terminaux" className="flex max-h-[70vh] w-[720px] max-w-[92vw] flex-col rounded-lg border border-tily-line bg-tily-panel p-2 shadow-xl" onKeyDown={keepTabInside}>
        <div className={`flex items-center gap-1 rounded border bg-tily-paper pr-1.5 ${valid ? 'border-tily-focus' : 'border-tily-error'}`}>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={LISTBOX_ID}
            aria-activedescendant={selectedLine ? `${RESULT_ID_PREFIX}${selected}` : undefined}
            aria-invalid={!valid}
            autoFocus
            spellCheck={false}
            placeholder="Rechercher dans tous les terminaux…"
            value={query}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] text-tily-ink outline-none placeholder:text-tily-muted"
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
          />
          <SearchOptionToggles options={options} onToggle={toggleSearchOption} />
        </div>
        <div ref={listRef} id={LISTBOX_ID} role="listbox" aria-label="Lignes trouvées" className="mt-2 min-h-0 flex-1 overflow-y-auto">
          {matches.length === 0 && <p className={`px-3 py-2 text-xs ${valid ? 'text-tily-muted' : 'text-tily-error'}`}>{emptyMessage}</p>}
          {matches.map((line, index) => {
            const handleHover = () => setSelectedId(line.id)
            const handleClick = () => goToTerminalLine(line)
            const { before, matched, after } = matchPartsOf(line)
            const isSelected = index === selected
            return (
              <div
                key={line.id}
                id={`${RESULT_ID_PREFIX}${index}`}
                role="option"
                aria-selected={isSelected}
                className={`rounded px-3 ${isSelected ? 'bg-tily-green-soft text-tily-green-deep' : 'text-tily-ink'}`}
                onPointerMove={handleHover}
              >
                <button type="button" tabIndex={-1} className="flex w-full min-w-0 cursor-pointer items-baseline gap-3 py-1.5 text-left focus:outline-none" onPointerDown={handleResultPointerDown} onClick={handleClick}>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] whitespace-pre">
                    {before}
                    <mark className="rounded-sm bg-tily-search-active px-px text-tily-ink">{matched}</mark>
                    {after}
                  </span>
                  <span className="max-w-[40%] shrink-0 truncate text-right text-[11px] text-tily-muted">{line.location}</span>
                </button>
              </div>
            )
          })}
        </div>
        <p className="mt-2 border-t border-tily-line px-3 pt-2 text-[11px] text-tily-muted">{footerOf(total, panes, matches.length)}</p>
      </div>
    </div>
  )
}
