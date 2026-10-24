import { bridge } from '../bridge/bridge'
import { ForgeKind, type MergeRequestBranchInfo, type MergeRequestCreated, type MergeRequestFormData, type MergeRequestInput } from '../bridge/forgeMessages'
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

export const openMergeRequestForm = (path: string, source?: string): void => {
  const request = nextRequest()
  returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
  useMergeRequestFormStore.getState().open({
    mode: MergeRequestFormMode.Create,
    path,
    request,
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
  })
  bridge.send({ type: 'forge.form', request, path, branch: source })
}

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

export const receiveMergeRequestForm = (request: number, data: MergeRequestFormData | undefined, error: string | undefined): void =>
  useMergeRequestFormStore.getState().update(request, (form) =>
    data
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
  bridge.send({ type: 'forge.compare', request: compareRequest, path: form.path, branch: fields.sourceBranch, target: fields.targetBranch })
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

export const canSubmitMergeRequest = (form: MergeRequestForm): boolean => {
  const { data, branch, fields, submitting, comparing } = form
  return (
    data !== null &&
    !submitting &&
    !comparing &&
    !branch?.error &&
    fields.title.trim().length > 0 &&
    fields.sourceBranch.length > 0 &&
    fields.targetBranch.length > 0 &&
    fields.sourceBranch !== fields.targetBranch
  )
}

export const submitMergeRequest = (): void => {
  const form = currentForm()
  if (!form || !canSubmitMergeRequest(form)) {
    return
  }
  updateForm(() => ({ submitting: true, submitError: null }))
  bridge.send({ type: 'forge.create', request: form.request, path: form.path, push: form.push && Boolean(form.branch?.publication.needsPush), mergeRequest: form.fields })
}

const refreshAfterCreation = (path: string, source: string): void => {
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
    refreshAfterCreation(path, source)
  }
}
