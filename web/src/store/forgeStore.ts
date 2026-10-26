import { create } from 'zustand'
import type { BranchMergeRequests, ForgeKind, MergeRequest, MergeRequestList } from '../bridge/forgeMessages'

export interface MergeRequestFilter {
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

export interface MergeRequestMenuRequest {
  x: number
  y: number
  path: string
  kind: ForgeKind | undefined
  items: MergeRequest[]
}

interface ForgeState {
  expanded: boolean
  listing: MergeRequestListing | null
  filter: MergeRequestFilter
  branches: Record<string, BranchMergeRequests>
  menu: MergeRequestMenuRequest | null
  setExpanded: (expanded: boolean) => void
  startListing: (path: string, request: number) => void
  finishListing: (request: number, list: MergeRequestList | null, error: string | null) => void
  setFilter: (filter: Partial<MergeRequestFilter>) => void
  setBranch: (key: string, result: BranchMergeRequests) => void
  setMenu: (menu: MergeRequestMenuRequest | null) => void
}

const DEFAULT_FILTER: MergeRequestFilter = { labels: [], assignees: [], text: '' }

export const branchKey = (path: string, branch: string): string => `${path.toLowerCase()}\n${branch}`

export const useForgeStore = create<ForgeState>()((set) => ({
  expanded: false,
  listing: null,
  filter: DEFAULT_FILTER,
  branches: {},
  menu: null,
  setExpanded: (expanded) => set({ expanded }),
  startListing: (path, request) =>
    set((state) => {
      const samePath = state.listing?.path.toLowerCase() === path.toLowerCase()
      return {
        listing: { path, request, loading: true, list: samePath ? (state.listing?.list ?? null) : null, error: null },
        filter: samePath ? state.filter : DEFAULT_FILTER,
      }
    }),
  finishListing: (request, list, error) =>
    set((state) => (state.listing?.request === request ? { listing: { ...state.listing, loading: false, list: list ?? state.listing.list, error } } : state)),
  setFilter: (filter) => set((state) => ({ filter: { ...state.filter, ...filter } })),
  setBranch: (key, result) =>
    set((state) => (JSON.stringify(state.branches[key]) === JSON.stringify(result) ? state : { branches: { ...state.branches, [key]: result } })),
  setMenu: (menu) => set({ menu }),
}))
