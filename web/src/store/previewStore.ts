import { create } from 'zustand'
import type { FilePreview } from '../bridge/previewMessages'

export interface PreviewEdit {
  base: string
  draft: string
  version: string | undefined
  generation: number
  saving: boolean
}

export interface ParkedPreview {
  path: string
  preview: FilePreview | null
  anchor: string | null
  edit: PreviewEdit | null
}

interface PreviewState {
  path: string | null
  preview: FilePreview | null
  anchor: string | null
  anchorRequest: number
  deferred: Record<string, string>
  parked: Record<string, ParkedPreview>
  edit: PreviewEdit | null
  pendingAction: (() => void) | null
  open: (path: string) => void
  receive: (preview: FilePreview, anchor: string | null, reload: boolean) => void
  jumpTo: (anchor: string) => void
  close: () => void
  defer: (tabId: string, path: string) => void
  takeDeferred: (tabId: string) => string | null
  park: (tabId: string) => void
  restore: (tabId: string) => string | null
  forget: (tabIds: string[]) => void
  startEdit: () => void
  stopEdit: () => void
  setDraft: (draft: string) => void
  markSaving: () => void
  receiveSave: (preview: FilePreview, saved: boolean) => void
  reloadFromDisk: () => void
  ask: (action: () => void) => void
  clearPending: () => void
}

export const normalizeLineEndings = (text: string): string => text.replace(/\r\n?/g, '\n')

export const editDirty = (edit: PreviewEdit | null): boolean => edit !== null && edit.draft !== edit.base

export const editable = (preview: FilePreview | null): boolean => preview !== null && !preview.error && !preview.truncated && preview.version !== undefined

const freshEdit = (preview: FilePreview, generation: number): PreviewEdit | null => {
  if (!editable(preview)) {
    return null
  }
  const text = normalizeLineEndings(preview.content)
  return { base: text, draft: text, version: preview.version, generation: generation + 1, saving: false }
}

const reconcile = (edit: PreviewEdit | null, preview: FilePreview): PreviewEdit | null => {
  if (!edit || preview.version === edit.version) {
    return edit
  }
  return editDirty(edit) ? edit : freshEdit(preview, edit.generation)
}

const savedState = (preview: FilePreview, edit: PreviewEdit, saved: boolean): { preview: FilePreview; edit: PreviewEdit | null } => {
  const stillEditing = { ...edit, saving: false }
  return saved && editable(preview)
    ? { preview, edit: { ...stillEditing, base: normalizeLineEndings(preview.content), version: preview.version } }
    : { preview, edit: reconcile(stillEditing, preview) }
}

const savingTabOf = (parked: Record<string, ParkedPreview>, path: string): string | undefined =>
  Object.keys(parked).find((tabId) => parked[tabId].path === path && parked[tabId].edit?.saving)

export const usePreviewStore = create<PreviewState>((set, get) => ({
  path: null,
  preview: null,
  anchor: null,
  anchorRequest: 0,
  deferred: {},
  parked: {},
  edit: null,
  pendingAction: null,
  open: (path) => set((state) => (state.path === path ? { path } : { path, preview: state.preview?.path === path ? state.preview : null, edit: null })),
  receive: (preview, anchor, reload) => {
    const { path, anchorRequest, edit } = get()
    if (path === null || (reload && preview.path !== path)) {
      return
    }
    const nextEdit = preview.path === path ? reconcile(edit, preview) : null
    set(reload ? { preview, edit: nextEdit } : { path: preview.path, preview, anchor, anchorRequest: anchorRequest + 1, edit: nextEdit })
  },
  jumpTo: (anchor) => set((state) => ({ anchor, anchorRequest: state.anchorRequest + 1 })),
  close: () => set({ path: null, preview: null, anchor: null, edit: null, pendingAction: null }),
  defer: (tabId, path) => set((state) => ({ deferred: { ...state.deferred, [tabId]: path } })),
  takeDeferred: (tabId) => {
    const { [tabId]: path, ...rest } = get().deferred
    if (path === undefined) {
      return null
    }
    set({ deferred: rest })
    return path
  },
  park: (tabId) =>
    set((state) =>
      state.path === null
        ? {}
        : { parked: { ...state.parked, [tabId]: { path: state.path, preview: state.preview, anchor: state.anchor, edit: state.edit } }, path: null, preview: null, anchor: null, edit: null, pendingAction: null },
    ),
  restore: (tabId) => {
    const { parked, anchorRequest } = get()
    const { [tabId]: entry, ...rest } = parked
    if (entry === undefined) {
      return null
    }
    set({ ...entry, parked: rest, anchorRequest: anchorRequest + 1 })
    return entry.path
  },
  forget: (tabIds) => set((state) => ({ parked: Object.fromEntries(Object.entries(state.parked).filter(([tabId]) => !tabIds.includes(tabId))) })),
  startEdit: () => set((state) => (state.preview && !state.edit ? { edit: freshEdit(state.preview, 0) } : {})),
  stopEdit: () => set({ edit: null }),
  setDraft: (draft) => set((state) => (state.edit ? { edit: { ...state.edit, draft } } : {})),
  markSaving: () => set((state) => (state.edit ? { edit: { ...state.edit, saving: true } } : {})),
  receiveSave: (preview, saved) => {
    const { path, edit, parked } = get()
    if (preview.path === path && edit) {
      set(savedState(preview, edit, saved))
      return
    }
    const tabId = savingTabOf(parked, preview.path)
    const entry = tabId === undefined ? undefined : parked[tabId]
    if (tabId !== undefined && entry?.edit) {
      set({ parked: { ...parked, [tabId]: { ...entry, ...savedState(preview, entry.edit, saved) } } })
    }
  },
  reloadFromDisk: () => set((state) => (state.preview && state.edit ? { edit: freshEdit(state.preview, state.edit.generation) } : {})),
  ask: (action) => set({ pendingAction: action }),
  clearPending: () => set({ pendingAction: null }),
}))
