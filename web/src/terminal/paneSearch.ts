import { SearchAddon, type ISearchOptions } from '@xterm/addon-search'
import type { Terminal } from '@xterm/xterm'
import { searchPattern, SearchOption, type SearchOptions } from '../model/textSearch'
import { NO_RESULTS, useTerminalSearchStore, type SearchResults } from '../store/terminalSearchStore'
import { focusPane } from './terminalActions'
import { terminalRegistry } from './terminalRegistry'

export enum SearchDirection {
  Previous = 'previous',
  Next = 'next',
}

type SearchDecorations = NonNullable<ISearchOptions['decorations']>

interface OptionKeys {
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  code: string
}

const HIGHLIGHT_LIMIT = 1000
const MAX_PREFILL_LENGTH = 200
const LINE_BREAK = /[\r\n]/
const MATCH_TOKEN = '--color-tily-search-match'
const ACTIVE_MATCH_TOKEN = '--color-tily-search-active'
const BORDER_TOKEN = '--color-tily-warning'
const OPTION_CODES: Record<string, SearchOption> = {
  KeyC: SearchOption.CaseSensitive,
  KeyW: SearchOption.WholeWord,
  KeyR: SearchOption.Regex,
}

const addons = new WeakMap<Terminal, SearchAddon>()
let decorations: SearchDecorations | undefined

const tokenColor = (token: string): string => getComputedStyle(document.documentElement).getPropertyValue(token).trim()

const searchDecorations = (): SearchDecorations => {
  if (!decorations) {
    const border = tokenColor(BORDER_TOKEN)
    decorations = { matchBackground: tokenColor(MATCH_TOKEN), activeMatchBackground: tokenColor(ACTIVE_MATCH_TOKEN), activeMatchBorder: border, matchOverviewRuler: border, activeMatchColorOverviewRuler: border }
  }
  return decorations
}

const addonOf = (paneId: string): SearchAddon | undefined => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  if (!terminal) {
    return undefined
  }
  let addon = addons.get(terminal)
  if (!addon) {
    addon = new SearchAddon({ highlightLimit: HIGHLIGHT_LIMIT })
    terminal.loadAddon(addon)
    addon.onDidChangeResults(({ resultIndex, resultCount }) => {
      const { paneId: searchedPaneId, setResults } = useTerminalSearchStore.getState()
      if (searchedPaneId === paneId) {
        setResults({ index: resultIndex, count: resultCount })
      }
    })
    addons.set(terminal, addon)
  }
  return addon
}

const clearPaneSearch = (paneId: string): void => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  if (terminal) {
    addons.get(terminal)?.clearDecorations()
  }
}

const selectedQuery = (terminal: Terminal): string | undefined => {
  const selection = terminal.getSelection()
  return selection.trim() !== '' && selection.length <= MAX_PREFILL_LENGTH && !LINE_BREAK.test(selection) ? selection : undefined
}

export const isQueryValid = (query: string, options: SearchOptions): boolean => query === '' || searchPattern(query, options) !== null

export const searchResultLabel = (query: string, options: SearchOptions, { index, count }: SearchResults): string => {
  if (query === '') {
    return ''
  }
  if (!isQueryValid(query, options)) {
    return 'Expression invalide'
  }
  if (count === 0) {
    return 'Aucun résultat'
  }
  const total = count >= HIGHLIGHT_LIMIT ? `${HIGHLIGHT_LIMIT}+` : `${count}`
  return index < 0 ? `${total} résultats` : `${index + 1}/${total}`
}

export const searchOptionOf = ({ altKey, ctrlKey, shiftKey, code }: OptionKeys): SearchOption | undefined => (altKey && !ctrlKey && !shiftKey ? OPTION_CODES[code] : undefined)

export const findInPane = (direction: SearchDirection, incremental = false): void => {
  const { paneId, query, options, setResults } = useTerminalSearchStore.getState()
  const addon = paneId ? addonOf(paneId) : undefined
  if (!addon) {
    return
  }
  if (query === '' || searchPattern(query, options) === null) {
    addon.clearDecorations()
    setResults(NO_RESULTS)
    return
  }
  const searchOptions: ISearchOptions = {
    caseSensitive: options[SearchOption.CaseSensitive],
    wholeWord: options[SearchOption.WholeWord],
    regex: options[SearchOption.Regex],
    incremental,
    decorations: searchDecorations(),
  }
  if (direction === SearchDirection.Previous) {
    addon.findPrevious(query, searchOptions)
  } else {
    addon.findNext(query, searchOptions)
  }
}

export const refreshPaneSearch = (): void => findInPane(SearchDirection.Previous, true)

export const changeSearchQuery = (query: string): void => {
  useTerminalSearchStore.getState().setQuery(query)
  refreshPaneSearch()
}

export const toggleSearchOption = (option: SearchOption): void => {
  useTerminalSearchStore.getState().toggleOption(option)
  refreshPaneSearch()
}

const switchSearchedPane = (paneId: string): void => {
  const { paneId: previous } = useTerminalSearchStore.getState()
  if (previous && previous !== paneId) {
    clearPaneSearch(previous)
  }
}

export const openPaneSearch = (paneId: string): void => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  const store = useTerminalSearchStore.getState()
  if (!terminal) {
    store.setGlobalOpen(true)
    return
  }
  const reopening = store.paneId === paneId
  const prefill = selectedQuery(terminal)
  switchSearchedPane(paneId)
  store.openBar(paneId, prefill)
  if (!reopening || prefill !== undefined) {
    refreshPaneSearch()
  }
}

export const revealPaneMatch = (paneId: string, row: number, query: string): void => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  if (!terminal) {
    return
  }
  switchSearchedPane(paneId)
  addonOf(paneId)?.clearDecorations()
  terminal.select(0, row, 1)
  useTerminalSearchStore.getState().openBar(paneId, query)
  findInPane(SearchDirection.Next, true)
}

export const closePaneSearch = (): void => {
  const { paneId, closeBar } = useTerminalSearchStore.getState()
  if (!paneId) {
    return
  }
  clearPaneSearch(paneId)
  closeBar()
  focusPane(paneId)
}
