import { create } from 'zustand'
import type { GitContext, ImportedPreferences, PersistenceSettings, PickedPath, Project, SettingsSnapshot, ShellProfile } from '../bridge/messages'

export enum StatusLevel {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
}

interface HostState {
  connected: boolean
  shells: ShellProfile[]
  home: string
  version: string
  applicationName: string
  status: { text: string; level: StatusLevel; at: string }
  leaderActive: boolean
  projects: Project[]
  projectsRoot: string
  projectsError: string | null
  contexts: Record<string, GitContext>
  unsaved: boolean
  persistence: PersistenceSettings
  settingsSnapshot: SettingsSnapshot | null
  pickedPath: PickedPath | null
  setPickedPath: (picked: PickedPath) => void
  importedPreferences: ImportedPreferences | null
  setImportedPreferences: (imported: ImportedPreferences) => void
  applySettings: (snapshot: SettingsSnapshot, shells: ShellProfile[], persistence: PersistenceSettings) => void
  setHello: (version: string, applicationName: string, shells: ShellProfile[], home: string, persistence: PersistenceSettings) => void
  setUnsaved: (unsaved: boolean) => void
  setStatus: (text: string, level?: StatusLevel) => void
  setLeaderActive: (active: boolean) => void
  setProjects: (root: string, projects: Project[], error: string | null) => void
  setContext: (paneId: string, context: GitContext) => void
}

export const useHostStore = create<HostState>()((set) => ({
  connected: false,
  shells: [],
  home: '',
  version: '',
  applicationName: 'Tily',
  status: { text: 'Connexion à l’hôte…', level: StatusLevel.Info, at: '' },
  leaderActive: false,
  projects: [],
  projectsRoot: '',
  projectsError: null,
  contexts: {},
  unsaved: false,
  persistence: { textIntervalSeconds: 30, linesPerPane: 10000, maxTextMebibytes: 256 },
  settingsSnapshot: null,
  pickedPath: null,
  setPickedPath: (pickedPath) => set({ pickedPath }),
  importedPreferences: null,
  setImportedPreferences: (importedPreferences) => set({ importedPreferences }),
  applySettings: (settingsSnapshot, shells, persistence) => set({ settingsSnapshot, shells, persistence }),
  setHello: (version, applicationName, shells, home, persistence) => set({ connected: true, version, applicationName, shells, home, persistence }),
  setUnsaved: (unsaved) => set({ unsaved }),
  setStatus: (text, level = StatusLevel.Info) => set({ status: { text, level, at: new Date().toISOString() } }),
  setLeaderActive: (leaderActive) => set({ leaderActive }),
  setProjects: (projectsRoot, projects, projectsError) => set({ projectsRoot, projects, projectsError }),
  setContext: (paneId, context) =>
    set((state) => {
      const known = state.contexts[paneId]
      const unchanged = known?.isRepository === context.isRepository && known.branch === context.branch && known.detachedHead === context.detachedHead && known.worktreeRoot === context.worktreeRoot
      return unchanged ? state : { contexts: { ...state.contexts, [paneId]: context } }
    }),
}))
