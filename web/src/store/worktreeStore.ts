import { create } from 'zustand'
import type { WorktreeBranchMode, WorktreeOperation, WorktreePlan, WorktreeSources } from '../bridge/worktreeMessages'

export enum WorktreePickerKind {
  Source = 'source',
  Open = 'open',
}

export interface WorktreeDraft {
  project: string
  repository: string
  remember: boolean
  branch: string
  mode: WorktreeBranchMode
  base: string
  folder: string | null
  rememberFolder: boolean
  install: boolean
  claude: boolean
  claudePrompt: string
  database: boolean
}

export interface WorktreeRemovalPane {
  paneId: string
  label: string
  agent: boolean
}

export interface WorktreeFailure {
  message: string
  output?: string
  lockedBy?: string[]
}

export interface WorktreeTask {
  request: number
  operation: WorktreeOperation
  fromDialog: boolean
  removal?: WorktreeRemoval
}

export interface WorktreePurge {
  name: string
  files: number
  elapsedMs: number
}

export interface WorktreeRemoval {
  path: string
  name: string
  branch?: string
  panes: WorktreeRemovalPane[]
  closePanes: boolean
  keepBranch: boolean
  dropDatabase: boolean
  failure: WorktreeFailure | null
  request?: number
  requestedBy?: string
}

interface WorktreeState {
  picker: WorktreePickerKind | null
  draft: WorktreeDraft | null
  sourcesRequest: number
  sources: WorktreeSources | null
  planRequest: number
  planPending: boolean
  plan: WorktreePlan | null
  createFailure: WorktreeFailure | null
  tasks: WorktreeTask[]
  purge: WorktreePurge | null
  removal: WorktreeRemoval | null
  setPicker: (picker: WorktreePickerKind | null) => void
  setDraft: (draft: WorktreeDraft | null) => void
  requestSources: () => number
  receiveSources: (request: number, sources: WorktreeSources) => boolean
  requestPlan: () => number
  receivePlan: (request: number, plan: WorktreePlan) => void
  setCreateFailure: (createFailure: WorktreeFailure | null) => void
  addTask: (task: WorktreeTask) => void
  takeTask: (request: number | undefined) => WorktreeTask | undefined
  setPurge: (purge: WorktreePurge | null) => void
  setRemoval: (removal: WorktreeRemoval | null) => void
}

export const useWorktreeStore = create<WorktreeState>()((set, get) => ({
  picker: null,
  draft: null,
  sourcesRequest: 0,
  sources: null,
  planRequest: 0,
  planPending: false,
  plan: null,
  createFailure: null,
  tasks: [],
  purge: null,
  removal: null,
  setPicker: (picker) => set({ picker }),
  setDraft: (draft) => set(draft ? { draft } : { draft, sources: null, plan: null, planPending: false, createFailure: null }),
  requestSources: () => {
    const sourcesRequest = get().sourcesRequest + 1
    set({ sourcesRequest, sources: null })
    return sourcesRequest
  },
  receiveSources: (request, sources) => {
    const current = get()
    if (current.sourcesRequest !== request || !current.draft) {
      return false
    }
    set({ sources })
    return true
  },
  requestPlan: () => {
    const planRequest = get().planRequest + 1
    set({ planRequest, planPending: true })
    return planRequest
  },
  receivePlan: (request, plan) => set((current) => (current.planRequest === request && current.draft ? { plan, planPending: false } : current)),
  setCreateFailure: (createFailure) => set({ createFailure }),
  addTask: (task) => set((current) => ({ tasks: [...current.tasks, task] })),
  takeTask: (request) => {
    const task = get().tasks.find((candidate) => candidate.request === request)
    if (task) {
      set((current) => ({ tasks: current.tasks.filter((candidate) => candidate !== task) }))
    }
    return task
  },
  setPurge: (purge) => set({ purge }),
  setRemoval: (removal) => set({ removal }),
}))

export const worktreeModalOpen = (): boolean => {
  const { picker, draft, removal } = useWorktreeStore.getState()
  return picker !== null || draft !== null || removal !== null
}
