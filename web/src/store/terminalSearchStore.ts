import { create } from 'zustand'
import { DEFAULT_SEARCH_OPTIONS, type SearchOption, type SearchOptions } from '../model/textSearch'

export interface SearchResults {
  index: number
  count: number
}

export const NO_RESULTS: SearchResults = { index: -1, count: 0 }

interface TerminalSearchState {
  paneId: string | null
  query: string
  options: SearchOptions
  results: SearchResults
  focusRequest: number
  globalOpen: boolean
  openBar: (paneId: string, query?: string) => void
  closeBar: () => void
  setQuery: (query: string) => void
  toggleOption: (option: SearchOption) => void
  setResults: (results: SearchResults) => void
  setGlobalOpen: (open: boolean) => void
}

export const useTerminalSearchStore = create<TerminalSearchState>()((set, get) => ({
  paneId: null,
  query: '',
  options: DEFAULT_SEARCH_OPTIONS,
  results: NO_RESULTS,
  focusRequest: 0,
  globalOpen: false,
  openBar: (paneId, query) =>
    set({ paneId, query: query ?? get().query, results: get().paneId === paneId ? get().results : NO_RESULTS, focusRequest: get().focusRequest + 1, globalOpen: false }),
  closeBar: () => set({ paneId: null, results: NO_RESULTS }),
  setQuery: (query) => set({ query }),
  toggleOption: (option) => set({ options: { ...get().options, [option]: !get().options[option] } }),
  setResults: (results) => set({ results }),
  setGlobalOpen: (globalOpen) => set({ globalOpen }),
}))

export const globalSearchOpen = (): boolean => useTerminalSearchStore.getState().globalOpen
