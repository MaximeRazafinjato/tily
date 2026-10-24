import { create } from 'zustand'
import { MergeRequestStateFilter, type BranchMergeRequests, type MergeRequestList } from '../bridge/forgeMessages'

export interface MergeRequestFilter {
  state: MergeRequestStateFilter
  labels: string[]
  assignees: string[]
  text: string
}

export interface MergeRequestListing {
  path: string
  request: number
  loading: boolean
  list: MergeRequestList | null
  error: string | null
}

interface ForgeState {
  expanded: boolean
  listing: MergeRequestListing | null
  filter: MergeRequestFilter
  branches: Record<string, BranchMergeRequests>
  setExpanded: (expanded: boolean) => void
  startListing: (path: string, request: number) => void
  finishListing: (request: number, list: MergeRequestList | null, error: string | null) => void
  setFilter: (filter: Partial<MergeRequestFilter>) => void
  setBranch: (key: string, result: BranchMergeRequests) => void
}

const DEFAULT_FILTER: MergeRequestFilter = { state: MergeRequestStateFilter.Open, labels: [], assignees: [], text: '' }

export const branchKey = (path: string, branch: string): string => `${path.toLowerCase()}\n${branch}`

export const useForgeStore = create<ForgeState>()((set) => ({
  expanded: false,
  listing: null,
  filter: DEFAULT_FILTER,
  branches: {},
  setExpanded: (expanded) => set({ expanded }),
  startListing: (path, request) =>
    set((state) => {
      const samePath = state.listing?.path.toLowerCase() === path.toLowerCase()
      return {
        listing: { path, request, loading: true, list: samePath ? (state.listing?.list ?? null) : null, error: null },
        filter: samePath ? state.filter : { ...DEFAULT_FILTER, state: state.filter.state },
      }
    }),
  finishListing: (request, list, error) =>
    set((state) => (state.listing?.request === request ? { listing: { ...state.listing, loading: false, list: list ?? state.listing.list, error } } : state)),
  setFilter: (filter) => set((state) => ({ filter: { ...state.filter, ...filter } })),
  setBranch: (key, result) =>
    set((state) => (JSON.stringify(state.branches[key]) === JSON.stringify(result) ? state : { branches: { ...state.branches, [key]: result } })),
}))
