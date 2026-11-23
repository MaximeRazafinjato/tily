import { create } from 'zustand'
import type { WindowInfo, WindowWorkspace } from '../bridge/windowMessages'

interface WindowState {
  detached: boolean
  windowId: string
  mainWorkspaces: WindowWorkspace[]
  detachedTabs: string[]
  setWindow: (window: WindowInfo) => void
  setMainWorkspaces: (workspaces: WindowWorkspace[]) => void
  setDetachedTabs: (tabs: string[]) => void
}

export const useWindowStore = create<WindowState>()((set) => ({
  detached: false,
  windowId: '',
  mainWorkspaces: [],
  detachedTabs: [],
  setWindow: (window) => set({ detached: window.detached, windowId: window.id, mainWorkspaces: window.mainWorkspaces ?? [] }),
  setMainWorkspaces: (mainWorkspaces) => set({ mainWorkspaces }),
  setDetachedTabs: (detachedTabs) => set({ detachedTabs }),
}))

export const isDetachedWindow = (): boolean => useWindowStore.getState().detached
