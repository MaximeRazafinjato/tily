import { create } from 'zustand'
import { SettingsSection } from '../components/settingsSections'

export enum RenameOrigin {
  Header = 'header',
  Panel = 'panel',
  TabBar = 'tabBar',
}

export interface TabDropTarget {
  workspaceId: string
  beforeTabId?: string
}

export interface WorkspaceDropTarget {
  beforeWorkspaceId?: string
}

export interface PaneActivityView {
  paneId: string
  label: string
  processes: string[]
}

export interface CloseConfirmation {
  title: string
  panes: PaneActivityView[]
  confirmLabel?: string
}

interface UiState {
  renamingWorkspaceId: string | null
  renameOrigin: RenameOrigin
  renamingTabId: string | null
  tabRenameOrigin: RenameOrigin
  draggingTabId: string | null
  tabDropTarget: TabDropTarget | null
  springWorkspaceIds: string[]
  draggingWorkspaceId: string | null
  workspaceDropTarget: WorkspaceDropTarget | null
  paletteOpen: boolean
  openPalette: () => void
  closePalette: () => void
  projectPickerOpen: boolean
  openProjectPicker: () => void
  closeProjectPicker: () => void
  settingsOpen: boolean
  settingsSection: SettingsSection
  openSettings: (section?: SettingsSection) => void
  closeSettings: () => void
  closeConfirmation: CloseConfirmation | null
  showCloseConfirmation: (confirmation: CloseConfirmation) => void
  hideCloseConfirmation: () => void
  startRenamingTab: (tabId: string, origin?: RenameOrigin) => void
  stopRenamingTab: () => void
  startRenamingWorkspace: (workspaceId: string, origin: RenameOrigin) => void
  stopRenamingWorkspace: () => void
  startDraggingTab: (tabId: string) => void
  setTabDropTarget: (target: TabDropTarget | null) => void
  openSpringWorkspace: (workspaceId: string) => void
  stopDraggingTab: () => void
  startDraggingWorkspace: (workspaceId: string) => void
  setWorkspaceDropTarget: (target: WorkspaceDropTarget | null) => void
  stopDraggingWorkspace: () => void
  zoomedPaneId: string | null
  togglePaneZoom: (paneId: string) => void
  clearPaneZoom: () => void
}

export const useUiStore = create<UiState>()((set) => ({
  renamingWorkspaceId: null,
  renameOrigin: RenameOrigin.Header,
  renamingTabId: null,
  tabRenameOrigin: RenameOrigin.TabBar,
  draggingTabId: null,
  tabDropTarget: null,
  springWorkspaceIds: [],
  draggingWorkspaceId: null,
  workspaceDropTarget: null,
  paletteOpen: false,
  openPalette: () => set({ paletteOpen: true, projectPickerOpen: false, settingsOpen: false }),
  closePalette: () => set({ paletteOpen: false }),
  projectPickerOpen: false,
  openProjectPicker: () => set({ projectPickerOpen: true, paletteOpen: false, settingsOpen: false }),
  closeProjectPicker: () => set({ projectPickerOpen: false }),
  settingsOpen: false,
  settingsSection: SettingsSection.Shells,
  openSettings: (settingsSection = SettingsSection.Shells) => set({ settingsOpen: true, settingsSection, paletteOpen: false, projectPickerOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),
  closeConfirmation: null,
  showCloseConfirmation: (closeConfirmation) => set({ closeConfirmation }),
  hideCloseConfirmation: () => set({ closeConfirmation: null }),
  startRenamingTab: (renamingTabId, tabRenameOrigin = RenameOrigin.TabBar) => set({ renamingTabId, tabRenameOrigin }),
  stopRenamingTab: () => set({ renamingTabId: null }),
  startRenamingWorkspace: (renamingWorkspaceId, renameOrigin) => set({ renamingWorkspaceId, renameOrigin }),
  stopRenamingWorkspace: () => set({ renamingWorkspaceId: null }),
  startDraggingTab: (draggingTabId) => set({ draggingTabId, tabDropTarget: null, springWorkspaceIds: [] }),
  setTabDropTarget: (tabDropTarget) => set({ tabDropTarget }),
  openSpringWorkspace: (workspaceId) =>
    set((state) => (state.springWorkspaceIds.includes(workspaceId) ? state : { springWorkspaceIds: [...state.springWorkspaceIds, workspaceId] })),
  stopDraggingTab: () => set({ draggingTabId: null, tabDropTarget: null, springWorkspaceIds: [] }),
  startDraggingWorkspace: (draggingWorkspaceId) => set({ draggingWorkspaceId, workspaceDropTarget: null }),
  setWorkspaceDropTarget: (workspaceDropTarget) => set({ workspaceDropTarget }),
  stopDraggingWorkspace: () => set({ draggingWorkspaceId: null, workspaceDropTarget: null }),
  zoomedPaneId: null,
  togglePaneZoom: (paneId) => set((state) => ({ zoomedPaneId: state.zoomedPaneId === paneId ? null : paneId })),
  clearPaneZoom: () => set({ zoomedPaneId: null }),
}))
