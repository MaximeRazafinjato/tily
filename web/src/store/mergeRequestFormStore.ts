import { create } from 'zustand'
import type { MergeRequestBranchInfo, MergeRequestFormData, MergeRequestInput } from '../bridge/forgeMessages'

export enum MergeRequestFormMode {
  Create = 'create',
  Edit = 'edit',
}

export interface MergeRequestForm {
  mode: MergeRequestFormMode
  path: string
  request: number
  number: number | null
  reference: string | null
  data: MergeRequestFormData | null
  loadError: string | null
  fields: MergeRequestInput
  push: boolean
  titleEdited: boolean
  descriptionEdited: boolean
  branch: MergeRequestBranchInfo | null
  compareRequest: number
  comparing: boolean
  compareError: string | null
  submitting: boolean
  submitError: string | null
  closeArmed: boolean
}

interface MergeRequestFormState {
  form: MergeRequestForm | null
  open: (form: MergeRequestForm) => void
  update: (request: number, change: (form: MergeRequestForm) => Partial<MergeRequestForm>) => void
  close: () => void
}

export const EMPTY_FIELDS: MergeRequestInput = {
  sourceBranch: '',
  targetBranch: '',
  title: '',
  description: '',
  reviewers: [],
  assignee: null,
  labels: [],
  draft: false,
}

export const useMergeRequestFormStore = create<MergeRequestFormState>()((set) => ({
  form: null,
  open: (form) => set({ form }),
  update: (request, change) => set((state) => (state.form?.request === request ? { form: { ...state.form, ...change(state.form) } } : state)),
  close: () => set({ form: null }),
}))

export const mergeRequestFormOpen = (): boolean => useMergeRequestFormStore.getState().form !== null
