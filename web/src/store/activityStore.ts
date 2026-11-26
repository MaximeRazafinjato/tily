import { create } from 'zustand'
import type { PaneUsage, ProcessUsage } from '../bridge/activityMessages'

interface ActivityStoreState {
  expanded: boolean
  open: string[]
  panes: PaneUsage[]
  host: ProcessUsage[]
  toggleExpanded: () => void
  toggleOpen: (id: string) => void
  setUsage: (panes: PaneUsage[], host: ProcessUsage[]) => void
}

export const useActivityStore = create<ActivityStoreState>()((set) => ({
  expanded: false,
  open: [],
  panes: [],
  host: [],
  toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
  toggleOpen: (id) => set((state) => ({ open: state.open.includes(id) ? state.open.filter((openId) => openId !== id) : [...state.open, id] })),
  setUsage: (panes, host) => set({ panes, host }),
}))
