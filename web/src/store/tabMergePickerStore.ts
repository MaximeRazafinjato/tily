import { create } from 'zustand'

interface TabMergePickerState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useTabMergePickerStore = create<TabMergePickerState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

export const tabMergePickerOpen = (): boolean => useTabMergePickerStore.getState().open
