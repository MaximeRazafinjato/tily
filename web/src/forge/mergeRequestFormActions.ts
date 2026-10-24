import { bridge } from '../bridge/bridge'
import {
  ForgeKind,
  MergeRequestState,
  type MergeRequest,
  type MergeRequestBranchInfo,
  type MergeRequestCreated,
  type MergeRequestEdit,
  type MergeRequestFormData,
  type MergeRequestInput,
  type MergeRequestUpdated,
} from '../bridge/forgeMessages'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { branchKey, useForgeStore } from '../store/forgeStore'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { EMPTY_FIELDS, MergeRequestFormMode, useMergeRequestFormStore, type MergeRequestForm } from '../store/mergeRequestFormStore'
import { kindNoun } from './mergeRequestLabels'
import { listMergeRequests, requestBranchMergeRequests } from './mergeRequestActions'

let lastRequest = 0
let returnFocus: HTMLElement | null = null

const nextRequest = (): number => {
  lastRequest += 1
  return lastRequest
}

const currentForm = (): MergeRequestForm | null => useMergeRequestFormStore.getState().form

const updateForm = (change: (form: MergeRequestForm) => Partial<MergeRequestForm>): void => {
  const form = currentForm()
  if (form) {
    useMergeRequestFormStore.getState().update(form.request, change)
  }
}

const suggested = (form: MergeRequestForm, branch: MergeRequestBranchInfo): Partial<MergeRequestForm> => ({
  branch,
  comparing: false,
  compareError: null,
  push: form.branch?.source === branch.source ? form.push : branch.publication.needsPush,
  fields: {
    ...form.fields,
    title: form.titleEdited ? form.fields.title : branch.title,
    description: form.descriptionEdited ? form.fields.description : branch.description,
  },
})

const startForm = (mode: MergeRequestFormMode, path: string, source: string | undefined, item: MergeRequest | null): void => {
  const request = nextRequest()
  returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
  useMergeRequestFormStore.getState().open({
    mode,
    path,
    request,
    number: item?.number ?? null,
    reference: item?.reference ?? null,
    data: null,
    loadError: null,
    fields: { ...EMPTY_FIELDS, sourceBranch: source ?? '' },
    push: false,
    titleEdited: false,
    descriptionEdited: false,
    branch: null,
    compareRequest: 0,
    comparing: false,
    compareError: null,
    submitting: false,
    submitError: null,
    closeArmed: false,
  })
  bridge.send({ type: 'forge.form', request, path, branch: source, number: item?.number })
}

export const openMergeRequestForm = (path: string, source?: string): void => startForm(MergeRequestFormMode.Create, path, source, null)

export const canEditMergeRequest = (item: MergeRequest): boolean => item.state === MergeRequestState.Open

export const openMergeRequestEditForm = (path: string, item: MergeRequest): void => {
  if (canEditMergeRequest(item)) {
    startForm(MergeRequestFormMode.Edit, path, item.sourceBranch, item)
  }
}

export const editMergeRequestLabel = (item: MergeRequest, kind: ForgeKind | undefined): string => `Modifier la ${kindNoun(kind)} ${item.reference}…`

export const createMergeRequestLabel = (path: string, branch: string | null): string =>
  `Créer une ${kindNoun(branch ? useForgeStore.getState().branches[branchKey(path, branch)]?.forge?.kind : undefined)}`

export const closeMergeRequestForm = (): void => {
  useMergeRequestFormStore.getState().close()
  if (returnFocus?.isConnected) {
    returnFocus.focus()
  } else {
    focusActivePane()
  }
  returnFocus = null
}

const loadedForEdit = (data: MergeRequestFormData, edit: MergeRequestEdit): Partial<MergeRequestForm> => ({
  branch: data.branch,
  push: false,
  data,
  loadError: null,
  reference: edit.reference,
  titleEdited: true,
  descriptionEdited: true,
  fields: { ...edit.input },
})

export const receiveMergeRequestForm = (request: number, data: MergeRequestFormData | undefined, error: string | undefined): void =>
  useMergeRequestFormStore.getState().update(request, (form) =>
    data?.edit
      ? loadedForEdit(data, data.edit)
      : data
      ? {
          branch: data.branch,
          push: data.branch.publication.needsPush,
          data,
          loadError: null,
          fields: {
            ...form.fields,
            sourceBranch: data.branch.source,
            targetBranch: data.branch.target,
            title: data.branch.title,
            description: data.branch.description,
            assignee: data.currentUser ?? null,
          },
        }
      : { loadError: error ?? 'Lecture du projet impossible.' },
  )

export const changeMergeRequestBranches = (change: Pick<Partial<MergeRequestInput>, 'sourceBranch' | 'targetBranch'>): void => {
  const form = currentForm()
  if (!form) {
    return
  }
  const fields = { ...form.fields, ...change }
  const compareRequest = nextRequest()
  updateForm(() => ({ fields, compareRequest, comparing: true, compareError: null }))
  bridge.send({ type: 'forge.compare', request: compareRequest, path: form.path, branch: fields.sourceBranch, target: fields.targetBranch, number: form.number ?? undefined })
}

export const receiveMergeRequestComparison = (request: number, branch: MergeRequestBranchInfo | undefined, error: string | undefined): void => {
  if (currentForm()?.compareRequest !== request) {
    return
  }
  updateForm((form) => (branch ? suggested(form, branch) : { comparing: false, compareError: error ?? 'Comparaison des branches impossible.' }))
}

export const changeMergeRequestTitle = (title: string): void => updateForm((form) => ({ fields: { ...form.fields, title }, titleEdited: true }))

export const changeMergeRequestDescription = (description: string): void =>
  updateForm((form) => ({ fields: { ...form.fields, description }, descriptionEdited: true }))

const toggled = (values: string[], value: string): string[] => (values.includes(value) ? values.filter((known) => known !== value) : [...values, value])

export const toggleMergeRequestReviewer = (login: string): void => updateForm((form) => ({ fields: { ...form.fields, reviewers: toggled(form.fields.reviewers, login) } }))

export const toggleMergeRequestAssignee = (login: string): void =>
  updateForm((form) => ({ fields: { ...form.fields, assignee: form.fields.assignee === login ? null : login } }))

export const toggleMergeRequestFormLabel = (name: string): void => updateForm((form) => ({ fields: { ...form.fields, labels: toggled(form.fields.labels, name) } }))

export const setMergeRequestDraft = (draft: boolean): void => updateForm((form) => ({ fields: { ...form.fields, draft } }))

export const setMergeRequestPush = (push: boolean): void => updateForm(() => ({ push }))

const sameSet = (left: string[], right: string[]): boolean => left.length === right.length && left.every((value) => right.includes(value))

const pushRequested = (form: MergeRequestForm): boolean => form.push && Boolean(form.branch?.publication.needsPush)

export const mergeRequestChanged = (form: MergeRequestForm): boolean => {
  const original = form.data?.edit?.input
  if (!original) {
    return true
  }
  const { fields } = form
  return (
    fields.title.trim() !== original.title ||
    fields.description.replace(/\r\n/g, '\n').trimEnd() !== original.description ||
    fields.targetBranch !== original.targetBranch ||
    fields.assignee !== original.assignee ||
    fields.draft !== original.draft ||
    !sameSet(fields.reviewers, original.reviewers) ||
    !sameSet(fields.labels, original.labels)
  )
}

const fieldsValid = (form: MergeRequestForm): boolean => {
  const { data, fields, submitting, comparing } = form
  return (
    data !== null &&
    !submitting &&
    !comparing &&
    fields.title.trim().length > 0 &&
    fields.sourceBranch.length > 0 &&
    fields.targetBranch.length > 0 &&
    fields.sourceBranch !== fields.targetBranch
  )
}

export const canSubmitMergeRequest = (form: MergeRequestForm): boolean =>
  fieldsValid(form) && !form.branch?.error && (form.mode === MergeRequestFormMode.Create || mergeRequestChanged(form) || pushRequested(form))

export const canCloseMergeRequest = (form: MergeRequestForm): boolean => form.mode === MergeRequestFormMode.Edit && Boolean(form.data?.edit) && fieldsValid(form)

const sendUpdate = (form: MergeRequestForm, close: boolean): void => {
  const edit = form.data?.edit
  if (!edit) {
    return
  }
  updateForm(() => ({ submitting: true, submitError: null }))
  bridge.send({ type: 'forge.update', request: form.request, path: form.path, number: edit.number, push: pushRequested(form), close, original: edit.input, mergeRequest: form.fields })
}

export const submitMergeRequest = (): void => {
  const form = currentForm()
  if (!form || !canSubmitMergeRequest(form)) {
    return
  }
  if (form.mode === MergeRequestFormMode.Edit) {
    sendUpdate(form, false)
    return
  }
  updateForm(() => ({ submitting: true, submitError: null }))
  bridge.send({ type: 'forge.create', request: form.request, path: form.path, push: pushRequested(form), mergeRequest: form.fields })
}

export const closeMergeRequest = (): void => {
  const form = currentForm()
  if (!form || !canCloseMergeRequest(form)) {
    return
  }
  if (form.closeArmed) {
    sendUpdate(form, true)
  } else {
    updateForm(() => ({ closeArmed: true }))
  }
}

export const disarmMergeRequestClose = (): void => updateForm(() => ({ closeArmed: false }))

const refreshAfterChange = (path: string, source: string): void => {
  const { branches, listing } = useForgeStore.getState()
  const paths = new Set([path.toLowerCase()])
  for (const key of Object.keys(branches)) {
    const separator = key.indexOf('\n')
    if (key.slice(separator + 1) === source) {
      paths.add(key.slice(0, separator))
    }
  }
  paths.forEach((known) => requestBranchMergeRequests(known, source, true))
  if (listing) {
    listMergeRequests(listing.path)
  }
}

export const receiveMergeRequestCreated = (request: number, path: string, source: string | undefined, created: MergeRequestCreated | undefined, error: string | undefined): void => {
  const shown = currentForm()?.request === request
  if (!created) {
    const noun = kindNoun(shown ? currentForm()?.data?.forge.kind : undefined)
    if (shown) {
      updateForm(() => ({ submitting: false, submitError: error ?? `Création de la ${noun} impossible.` }))
    } else {
      useHostStore.getState().setStatus(error ?? `Création de la ${noun} impossible.`, StatusLevel.Error)
    }
    return
  }
  if (shown) {
    closeMergeRequestForm()
  }
  const announced = `${kindNoun(created.reference.startsWith('!') ? ForgeKind.GitLab : ForgeKind.GitHub)} ${created.reference} créée.`
  useHostStore.getState().setStatus(created.warnings.length > 0 ? `${announced} ${created.warnings.join(' ')}` : announced, created.warnings.length > 0 ? StatusLevel.Warning : StatusLevel.Info)
  if (source) {
    refreshAfterChange(path, source)
  }
}

export const receiveMergeRequestUpdated = (request: number, path: string, source: string | undefined, updated: MergeRequestUpdated | undefined, error: string | undefined): void => {
  const shown = currentForm()?.request === request
  if (!updated) {
    const failure = error ?? `Modification de la ${kindNoun(shown ? currentForm()?.data?.forge.kind : undefined)} impossible.`
    if (shown) {
      updateForm(() => ({ submitting: false, closeArmed: false, submitError: failure }))
    } else {
      useHostStore.getState().setStatus(failure, StatusLevel.Error)
    }
    return
  }
  if (shown) {
    closeMergeRequestForm()
  }
  const announced = `${kindNoun(updated.reference.startsWith('!') ? ForgeKind.GitLab : ForgeKind.GitHub)} ${updated.reference} ${updated.closed ? 'fermée' : 'modifiée'}.`
  useHostStore.getState().setStatus(updated.warnings.length > 0 ? `${announced} ${updated.warnings.join(' ')}` : announced, updated.warnings.length > 0 ? StatusLevel.Warning : StatusLevel.Info)
  if (source) {
    refreshAfterChange(path, source)
  }
}
