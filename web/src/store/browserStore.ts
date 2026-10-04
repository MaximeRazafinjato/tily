import { create } from 'zustand'
import type { BrowserState } from '../bridge/browserMessages'

interface BrowserStoreState {
  states: Record<string, BrowserState>
  snapshots: Record<string, string>
  failures: Record<string, string>
  editingUrl: string | null
  setState: (state: BrowserState) => void
  setSnapshot: (paneId: string, image: string) => void
  clearSnapshot: (paneId: string) => void
  setFailure: (paneId: string, message: string) => void
  editUrl: (paneId: string | null) => void
  forget: (paneId: string) => void
}

const without = <T>(values: Record<string, T>, paneId: string): Record<string, T> => {
  const { [paneId]: _removed, ...rest } = values
  return rest
}

export const useBrowserStore = create<BrowserStoreState>()((set) => ({
  states: {},
  snapshots: {},
  failures: {},
  editingUrl: null,
  setState: (state) => set((current) => ({ states: { ...current.states, [state.pane]: state }, failures: without(current.failures, state.pane) })),
  setSnapshot: (paneId, image) => set((current) => ({ snapshots: { ...current.snapshots, [paneId]: image } })),
  clearSnapshot: (paneId) => set((current) => (paneId in current.snapshots ? { snapshots: without(current.snapshots, paneId) } : current)),
  setFailure: (paneId, message) => set((current) => ({ failures: { ...current.failures, [paneId]: message } })),
  editUrl: (editingUrl) => set({ editingUrl }),
  forget: (paneId) =>
    set((current) => ({ states: without(current.states, paneId), snapshots: without(current.snapshots, paneId), failures: without(current.failures, paneId) })),
}))
