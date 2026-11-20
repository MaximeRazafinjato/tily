import { GitRefKind, type GitCommit, type GitRefLabel } from '../bridge/gitMessages'
import { useGitStore } from '../store/gitStore'
import { useSessionStore } from '../store/sessionStore'
import { focusGitGraph } from './gitFocus'
import { shortSha } from './gitLabels'
import { commitMenu, graphColumnsMenu, labelMenu, stashMenu, workingTreeMenu } from './gitMenus'
import { activateBranch, activateRemote } from './gitRefActions'
import { openGitMenu, selectWorkingTree, showCommit } from './gitRequests'

const restoreGraphFocus = (): void => {
  focusGitGraph()
}

export const openCommitMenu = (commit: GitCommit, x: number, y: number): void => {
  const state = useGitStore.getState().state
  if (!state) {
    return
  }
  showCommit(commit.sha)
  const stash = commit.stash ? state.stashes.find((candidate) => candidate.sha === commit.sha) : undefined
  openGitMenu({
    x,
    y,
    label: stash ? `Actions de stash@{${stash.index}}` : `Actions du commit ${shortSha(commit.sha)}`,
    items: stash ? stashMenu(stash, state) : commitMenu(commit, state),
    restoreFocus: restoreGraphFocus,
  })
}

export const openWorkingTreeMenu = (x: number, y: number): void => {
  const state = useGitStore.getState().state
  if (state) {
    selectWorkingTree()
    openGitMenu({ x, y, label: 'Actions des modifications', items: workingTreeMenu(state), restoreFocus: restoreGraphFocus })
  }
}

export const openLabelMenu = (label: GitRefLabel, x: number, y: number): void => {
  const state = useGitStore.getState().state
  const items = state ? labelMenu(label, state) : []
  if (items.length > 0) {
    openGitMenu({ x, y, label: `Actions de ${label.name}`, items, restoreFocus: restoreGraphFocus })
  }
}

export const activateLabel = (label: GitRefLabel): void => {
  const state = useGitStore.getState().state
  const branch = label.kind === GitRefKind.Branch ? state?.branches.find((candidate) => candidate.name === label.name) : undefined
  const remote = label.kind === GitRefKind.Remote ? state?.remoteBranches.find((candidate) => candidate.name === label.name) : undefined
  if (branch) {
    activateBranch(branch)
  } else if (remote) {
    activateRemote(remote)
  }
}

export const openColumnsMenu = (x: number, y: number): void => {
  const { session, setGitGraphLayout } = useSessionStore.getState()
  if (session) {
    openGitMenu({ x, y, label: 'Colonnes affichées', items: graphColumnsMenu(session.gitGraph, setGitGraphLayout), restoreFocus: restoreGraphFocus })
  }
}
