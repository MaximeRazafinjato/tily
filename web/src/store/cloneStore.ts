import { create } from 'zustand'
import type { ClonePlan } from '../bridge/cloneMessages'

export interface CloneDraft {
  url: string
  folder: string | null
  name: string
  install: boolean
  claude: boolean
}

export interface CloneFailure {
  message: string
  output?: string
}

export interface CloneTask {
  request: number
  inActiveWorkspace: boolean
  fromDialog: boolean
}

interface CloneState {
  draft: CloneDraft | null
  lastRequest: number
  planRequest: number
  planPending: boolean
  plan: ClonePlan | null
  roots: string[]
  suggestRequest: number
  failure: CloneFailure | null
  tasks: CloneTask[]
  progress: string | null
  setDraft: (draft: CloneDraft | null) => void
  nextRequest: () => number
  requestPlan: () => number
  receivePlan: (request: number, plan: ClonePlan, roots: string[]) => void
  requestSuggestion: () => number
  setFailure: (failure: CloneFailure | null) => void
  addTask: (task: CloneTask) => void
  takeTask: (request: number) => CloneTask | undefined
  detachTasks: () => void
  setProgress: (progress: string | null) => void
}

export const useCloneStore = create<CloneState>()((set, get) => ({
  draft: null,
  lastRequest: 0,
  planRequest: 0,
  planPending: false,
  plan: null,
  roots: [],
  suggestRequest: 0,
  failure: null,
  tasks: [],
  progress: null,
  setDraft: (draft) => set(draft ? { draft } : { draft, plan: null, planPending: false, failure: null }),
  nextRequest: () => {
    const lastRequest = get().lastRequest + 1
    set({ lastRequest })
    return lastRequest
  },
  requestPlan: () => {
    const planRequest = get().nextRequest()
    set({ planRequest, planPending: true })
    return planRequest
  },
  receivePlan: (request, plan, roots) => set((current) => (current.planRequest === request && current.draft ? { plan, roots, planPending: false } : current)),
  requestSuggestion: () => {
    const suggestRequest = get().nextRequest()
    set({ suggestRequest })
    return suggestRequest
  },
  setFailure: (failure) => set({ failure }),
  addTask: (task) => set((current) => ({ tasks: [...current.tasks, task] })),
  takeTask: (request) => {
    const task = get().tasks.find((candidate) => candidate.request === request)
    if (task) {
      set((current) => ({ tasks: current.tasks.filter((candidate) => candidate !== task) }))
    }
    return task
  },
  detachTasks: () => set((current) => ({ tasks: current.tasks.map((task) => ({ ...task, fromDialog: false })) })),
  setProgress: (progress) => set({ progress }),
}))

export const cloneDialogOpen = (): boolean => useCloneStore.getState().draft !== null

export const cloneFromDialogPending = (tasks: CloneTask[]): boolean => tasks.some((task) => task.fromDialog)
