import { GitRefKind, GitResetMode, type GitBranch, type GitCommit, type GitRefLabel, type GitRemoteBranch, type GitState, type GitStash, type GitTag } from '../bridge/gitMessages'
import { WorktreeBranchMode, type Worktree } from '../bridge/worktreeMessages'
import type { ActionMenuItem } from '../components/ActionMenu'
import { revealInExplorer } from '../explorer/fileExplorerActions'
import { createMergeRequestLabel, openMergeRequestForm } from '../forge/mergeRequestFormActions'
import { openWorktree, openWorktreeDialog, requestWorktreeRemoval } from '../worktree/worktreeActions'
import type { GitGraphLayout } from '../model/session'
import type { GitRefHandle } from '../store/gitStore'
import { currentName, shortSha } from './gitLabels'
import {
  applyStash,
  checkoutCommit,
  cherryPickCommit,
  revertCommit,
  deleteBranch,
  deleteRemoteBranch,
  deleteTag,
  dropStash,
  mergeIntoCurrent,
  promptNewBranch,
  promptNewTag,
  promptRenameBranch,
  promptStash,
  pushTag,
  rebaseCurrentOnto,
  resetCurrentTo,
  switchToBranch,
  switchToRemote,
} from './gitRefActions'
import { copyToClipboard, revealCommit, stageChanges } from './gitRequests'

const copyName = (name: string): ActionMenuItem => ({ id: 'copy', label: 'Copier le nom', run: () => copyToClipboard(name, `Nom copié : ${name}`) })

const WORKTREE_FROM_BRANCH = 'Créer un worktree depuis cette branche…'
const ORIGIN = 'origin'

const mergeRequestFrom = (branch: string, state: GitState): ActionMenuItem => ({
  id: 'merge-request',
  label: `${createMergeRequestLabel(state.root, currentName(state.head))} depuis cette branche…`,
  run: () => openMergeRequestForm(state.root, branch),
})

export const worktreeOfBranch = (name: string, state: GitState): Worktree | undefined => state.worktrees.find((worktree) => worktree.branch === name)

const worktreeFromBranch = (branch: GitBranch, state: GitState): ActionMenuItem => ({
  id: 'worktree',
  label: WORKTREE_FROM_BRANCH,
  run: () =>
    openWorktreeDialog(state.root, worktreeOfBranch(branch.name, state) ? { mode: WorktreeBranchMode.New, base: branch.name } : { mode: WorktreeBranchMode.Local, branch: branch.name }),
})

export const worktreeMenu = (worktree: Worktree): ActionMenuItem[] => [
  { id: 'open', label: 'Ouvrir', run: () => openWorktree(worktree.path) },
  { id: 'reveal', label: 'Afficher dans l’Explorateur Windows', run: () => revealInExplorer(worktree.path) },
  { id: 'copy', label: 'Copier le chemin', run: () => copyToClipboard(worktree.path, `Chemin copié : ${worktree.path}`) },
  { id: 'remove', label: 'Supprimer le worktree…', disabled: worktree.isMain, run: () => requestWorktreeRemoval(worktree.path, worktree.branch) },
]

export const branchMenu = (branch: GitBranch, state: GitState): ActionMenuItem[] => {
  const current = currentName(state.head)
  const blocked = Boolean(state.operation)
  return [
    { id: 'switch', label: 'Checkout de cette branche', disabled: branch.current || blocked, run: () => switchToBranch(branch) },
    { id: 'merge', label: `Merge dans « ${current} »`, disabled: branch.current || blocked, run: () => mergeIntoCurrent(branch.name) },
    { id: 'rebase', label: `Rebase de « ${current} » sur cette branche`, disabled: branch.current || blocked || state.head.detached, run: () => rebaseCurrentOnto(branch.name) },
    { id: 'show', label: 'Aller au commit', run: () => revealCommit(branch.sha) },
    { id: 'branch', label: 'Créer une branche ici…', run: () => promptNewBranch(branch.name, branch.name) },
    { id: 'tag', label: 'Créer un tag ici…', run: () => promptNewTag(branch.sha, `« ${branch.name} »`) },
    worktreeFromBranch(branch, state),
    mergeRequestFrom(branch.name, state),
    { id: 'rename', label: 'Renommer…', run: () => promptRenameBranch(branch) },
    { id: 'delete', label: branch.merged ? 'Supprimer' : 'Supprimer (sans merge)…', disabled: branch.current, run: () => deleteBranch(branch) },
    copyName(branch.name),
  ]
}

export const remoteBranchMenu = (branch: GitRemoteBranch, state: GitState): ActionMenuItem[] => {
  const current = currentName(state.head)
  const blocked = Boolean(state.operation)
  return [
    { id: 'switch', label: 'Checkout (branche locale suivie)', disabled: blocked, run: () => switchToRemote(branch) },
    { id: 'merge', label: `Merge dans « ${current} »`, disabled: blocked, run: () => mergeIntoCurrent(branch.name) },
    { id: 'rebase', label: `Rebase de « ${current} » sur cette branche`, disabled: blocked || state.head.detached, run: () => rebaseCurrentOnto(branch.name) },
    { id: 'show', label: 'Aller au commit', run: () => revealCommit(branch.sha) },
    { id: 'branch', label: 'Créer une branche ici…', run: () => promptNewBranch(branch.name, branch.name) },
    { id: 'worktree', label: WORKTREE_FROM_BRANCH, run: () => openWorktreeDialog(state.root, { mode: WorktreeBranchMode.Remote, branch: branch.name }) },
    ...(branch.remote === ORIGIN ? [mergeRequestFrom(branch.branch, state)] : []),
    { id: 'delete', label: 'Supprimer la branche distante…', run: () => deleteRemoteBranch(branch) },
    copyName(branch.name),
  ]
}

export const tagMenu = (tag: GitTag, state: GitState): ActionMenuItem[] => [
  { id: 'show', label: 'Aller au commit', run: () => revealCommit(tag.sha) },
  { id: 'push', label: 'Push du tag', disabled: state.remotes.length === 0, run: () => pushTag(tag) },
  { id: 'branch', label: 'Créer une branche ici…', run: () => promptNewBranch(tag.sha, tag.name) },
  { id: 'delete', label: 'Supprimer le tag', run: () => deleteTag(tag) },
  copyName(tag.name),
]

export const stashMenu = (stash: GitStash, state: GitState): ActionMenuItem[] => [
  { id: 'show', label: 'Voir les modifications', run: () => revealCommit(stash.sha) },
  { id: 'apply', label: 'Appliquer', disabled: Boolean(state.operation), run: () => applyStash(stash, false) },
  { id: 'pop', label: 'Appliquer et supprimer', disabled: Boolean(state.operation), run: () => applyStash(stash, true) },
  { id: 'drop', label: 'Supprimer…', run: () => dropStash(stash) },
]

export const commitMenu = (commit: GitCommit, state: GitState): ActionMenuItem[] => {
  const current = currentName(state.head)
  const isHead = commit.sha === state.head.sha
  const blocked = Boolean(state.operation)
  const short = shortSha(commit.sha)
  return [
    { id: 'checkout', label: 'Checkout de ce commit (HEAD détachée)', disabled: isHead || blocked, run: () => checkoutCommit(commit) },
    { id: 'branch', label: 'Créer une branche ici…', run: () => promptNewBranch(commit.sha, short) },
    { id: 'tag', label: 'Créer un tag ici…', run: () => promptNewTag(commit.sha, short) },
    { id: 'cherry-pick', label: `Cherry-pick sur « ${current} »`, disabled: isHead || blocked, run: () => cherryPickCommit(commit) },
    { id: 'revert', label: `Revert sur « ${current} »`, disabled: blocked, run: () => revertCommit(commit) },
    { id: 'merge', label: `Merge dans « ${current} »`, disabled: isHead || blocked, run: () => mergeIntoCurrent(commit.sha) },
    { id: 'rebase', label: `Rebase de « ${current} » ici`, disabled: isHead || blocked || state.head.detached, run: () => rebaseCurrentOnto(commit.sha) },
    { id: 'reset-soft', label: `Reset soft de « ${current} » ici`, disabled: isHead || blocked, run: () => resetCurrentTo(commit, GitResetMode.Soft) },
    { id: 'reset-mixed', label: `Reset mixed de « ${current} » ici`, disabled: isHead || blocked, run: () => resetCurrentTo(commit, GitResetMode.Mixed) },
    { id: 'reset-hard', label: `Reset hard de « ${current} » ici…`, disabled: isHead || blocked, run: () => resetCurrentTo(commit, GitResetMode.Hard) },
    { id: 'copy-sha', label: 'Copier le SHA', run: () => copyToClipboard(commit.sha, `SHA copié : ${short}`) },
    { id: 'copy-subject', label: 'Copier le message', run: () => copyToClipboard(commit.subject, 'Message copié.') },
  ]
}

export const workingTreeMenu = (state: GitState): ActionMenuItem[] => [
  { id: 'stage', label: 'Stage de tout', disabled: state.unstagedTotal === 0, run: () => stageChanges([]) },
  { id: 'stash', label: 'Stash des modifications…', disabled: state.stagedTotal + state.unstagedTotal === 0, run: promptStash },
  { id: 'branch', label: 'Créer une branche depuis HEAD…', disabled: state.head.unborn, run: () => promptNewBranch() },
]

const remoteDeletions = (label: GitRefLabel, state: GitState): ActionMenuItem[] =>
  state.remoteBranches
    .filter((remote) => label.remotes.includes(remote.name))
    .map((remote) => ({ id: `delete-${remote.name}`, label: `Supprimer la branche distante « ${remote.name} »…`, run: () => deleteRemoteBranch(remote) }))

export const labelMenu = (label: GitRefLabel, state: GitState): ActionMenuItem[] => {
  const branch = label.kind === GitRefKind.Branch ? state.branches.find((candidate) => candidate.name === label.name) : undefined
  const remote = label.kind === GitRefKind.Remote ? state.remoteBranches.find((candidate) => candidate.name === label.name) : undefined
  const tag = label.kind === GitRefKind.Tag ? state.tags.find((candidate) => candidate.name === label.name) : undefined
  if (branch) {
    return [...branchMenu(branch, state), ...remoteDeletions(label, state)]
  }
  if (remote) {
    return remoteBranchMenu(remote, state)
  }
  return tag ? tagMenu(tag, state) : []
}

const isCurrentBranch = (handle: GitRefHandle, state: GitState): boolean => handle.kind === GitRefKind.Branch && !state.head.detached && handle.name === state.head.branch

export const canDropRef = (source: GitRefHandle, target: GitRefHandle, state: GitState): boolean =>
  !state.operation && (source.kind !== target.kind || source.name !== target.name) && (isCurrentBranch(source, state) || isCurrentBranch(target, state))

export const dropMenu = (source: GitRefHandle, target: GitRefHandle, state: GitState): ActionMenuItem[] => {
  const current = currentName(state.head)
  const other = isCurrentBranch(target, state) ? source.name : target.name
  return [
    { id: 'merge', label: `Merge de « ${other} » dans « ${current} »`, run: () => mergeIntoCurrent(other) },
    { id: 'rebase', label: `Rebase de « ${current} » sur « ${other} »`, run: () => rebaseCurrentOnto(other) },
  ]
}

export const graphColumnsMenu = (layout: GitGraphLayout, change: (patch: Partial<GitGraphLayout>) => void): ActionMenuItem[] => [
  { id: 'author', label: layout.authorShown ? 'Masquer la colonne Auteur' : 'Afficher la colonne Auteur', run: () => change({ authorShown: !layout.authorShown }) },
  { id: 'date', label: layout.dateShown ? 'Masquer la colonne Date' : 'Afficher la colonne Date', run: () => change({ dateShown: !layout.dateShown }) },
  { id: 'references', label: layout.referencesOpen ? 'Masquer les branches, tags et stash' : 'Afficher les branches, tags et stash', run: () => change({ referencesOpen: !layout.referencesOpen }) },
]
