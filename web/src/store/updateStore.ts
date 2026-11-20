import { create } from 'zustand'
import type { ReleaseHistoryEntry, UpdateInfo } from '../bridge/updateMessages'

interface UpdateState {
  info: UpdateInfo | null
  dialogOpen: boolean
  history: ReleaseHistoryEntry[] | null
  historyLoading: boolean
  historyError: string | null
  setInfo: (info: UpdateInfo) => void
  openDialog: () => void
  closeDialog: () => void
  startHistory: () => void
  setHistory: (history: ReleaseHistoryEntry[] | null, error: string | null) => void
}

export const useUpdateStore = create<UpdateState>()((set) => ({
  info: null,
  dialogOpen: false,
  history: null,
  historyLoading: false,
  historyError: null,
  setInfo: (info) => set({ info }),
  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => set({ dialogOpen: false }),
  startHistory: () => set({ historyLoading: true, historyError: null }),
  setHistory: (history, historyError) => set({ history, historyError, historyLoading: false }),
}))
