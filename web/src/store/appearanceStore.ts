import { create } from 'zustand'
import type { AccentPreset, AmbiancePreset, AmbianceSettings, AppearanceState, FolderProject } from '../bridge/appearanceMessages'

export interface ColorTarget {
  workspaceId: string
  tabId?: string
}

interface AppearanceStoreState {
  state: AppearanceState | null
  accentPresets: AccentPreset[]
  projects: Record<string, FolderProject>
  colorTarget: ColorTarget | null
  ambiance: AmbianceSettings | null
  ambiancePresets: AmbiancePreset[]
  setAccentPresets: (accentPresets: AccentPreset[]) => void
  setState: (state: AppearanceState) => void
  setProjects: (projects: FolderProject[]) => void
  openColorDialog: (target: ColorTarget) => void
  closeColorDialog: () => void
  setAmbiance: (ambiance: AmbianceSettings) => void
  setAmbiancePresets: (ambiancePresets: AmbiancePreset[]) => void
}

export const projectKey = (path: string): string => path.toLowerCase()

export const useAppearanceStore = create<AppearanceStoreState>()((set) => ({
  state: null,
  accentPresets: [],
  projects: {},
  colorTarget: null,
  ambiance: null,
  ambiancePresets: [],
  setAccentPresets: (accentPresets) => set({ accentPresets }),
  setState: (state) => set({ state }),
  setProjects: (projects) => set({ projects: Object.fromEntries(projects.map((project) => [projectKey(project.path), project])) }),
  openColorDialog: (colorTarget) => set({ colorTarget }),
  closeColorDialog: () => set({ colorTarget: null }),
  setAmbiance: (ambiance) => set({ ambiance }),
  setAmbiancePresets: (ambiancePresets) => set({ ambiancePresets }),
}))
