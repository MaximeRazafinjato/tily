import { bridge } from '../bridge/bridge'
import type { BranchMergeRequests, MergeRequestList } from '../bridge/forgeMessages'
import { BrowserPlacement, openBrowser } from '../browser/browserActions'
import { branchKey, useForgeStore } from '../store/forgeStore'
import { useGitStore } from '../store/gitStore'

let lastRequest = 0

export const listMergeRequests = (path: string): void => {
  lastRequest += 1
  useForgeStore.getState().startListing(path, lastRequest)
  bridge.send({ type: 'forge.list', request: lastRequest, path })
}

export const receiveMergeRequestList = (request: number, list: MergeRequestList | undefined, error: string | undefined): void =>
  useForgeStore.getState().finishListing(request, list ?? null, error ?? null)

export const requestBranchMergeRequests = (path: string, branch: string, force = false): void =>
  bridge.send({ type: 'forge.branch', path, branch, force })

export const receiveBranchMergeRequests = (path: string, branch: string, result: BranchMergeRequests): void =>
  useForgeStore.getState().setBranch(branchKey(path, branch), result)

export const refreshMergeRequests = (path: string, branch: string | null): void => {
  listMergeRequests(path)
  if (branch) {
    requestBranchMergeRequests(path, branch, true)
  }
}

export const toggleMergeRequests = (): void => {
  const { expanded, setExpanded } = useForgeStore.getState()
  setExpanded(!expanded)
}

export const toggleMergeRequestLabel = (label: string): void => {
  const { filter, setFilter } = useForgeStore.getState()
  setFilter({ labels: filter.labels.includes(label) ? filter.labels.filter((known) => known !== label) : [...filter.labels, label] })
}

export const toggleMergeRequestAssignee = (login: string): void => {
  const { filter, setFilter } = useForgeStore.getState()
  setFilter({ assignees: filter.assignees.includes(login) ? filter.assignees.filter((known) => known !== login) : [...filter.assignees, login] })
}

export const setMergeRequestText = (text: string): void => useForgeStore.getState().setFilter({ text })

export const clearMergeRequestFilters = (): void => useForgeStore.getState().setFilter({ labels: [], assignees: [], text: '' })

export const openMergeRequest = (url: string, inTily: boolean): void => {
  if (inTily) {
    useGitStore.getState().setGraphOpen(false)
    openBrowser(BrowserPlacement.Beside, url)
  } else {
    bridge.send({ type: 'link.open', url })
  }
}
