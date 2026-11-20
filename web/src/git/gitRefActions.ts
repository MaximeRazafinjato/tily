import { GitResetMode, GitSwitchTarget, type GitBranch, type GitCommit, type GitRemoteBranch, type GitStash, type GitTag } from '../bridge/gitMessages'
import { GitPromptKind, useGitStore } from '../store/gitStore'
import { currentName, plural, shortSha } from './gitLabels'
import { askConfirmation, pullBranch, retryOnFailure, withRoot } from './gitRequests'

const currentBranchName = (): string => {
  const state = useGitStore.getState().state
  return state ? currentName(state.head) : 'HEAD'
}

export const mergeIntoCurrent = (reference: string): void => withRoot((path) => ({ type: 'git.merge', path, reference }))

export const rebaseCurrentOnto = (reference: string): void => withRoot((path) => ({ type: 'git.rebase', path, reference }))

export const cherryPickCommit = (commit: GitCommit): void => withRoot((path) => ({ type: 'git.cherryPick', path, commit: commit.sha }))

export const revertCommit = (commit: GitCommit): void => withRoot((path) => ({ type: 'git.revert', path, commit: commit.sha }))

export const checkoutCommit = (commit: GitCommit): void => withRoot((path) => ({ type: 'git.switch', path, reference: commit.sha, target: GitSwitchTarget.Commit }))

export const resetCurrentTo = (commit: GitCommit, mode: GitResetMode): void => {
  const run = () => withRoot((path) => ({ type: 'git.reset', path, commit: commit.sha, mode, confirmed: mode === GitResetMode.Hard }))
  if (mode !== GitResetMode.Hard) {
    run()
    return
  }
  askConfirmation({
    title: `Reset hard de « ${currentBranchName()} » vers ${shortSha(commit.sha)} ?`,
    body: 'La branche revient à ce commit et les modifications locales non committées sont effacées.',
    detail: `« ${commit.subject} »\n« Annuler » dans la vue Git peut tout restaurer tant qu’aucune autre opération n’est faite.`,
    confirmLabel: 'Reset hard',
    run,
  })
}

export const switchToBranch = (branch: GitBranch): void => withRoot((path) => ({ type: 'git.switch', path, reference: branch.name, target: GitSwitchTarget.Branch }))

export const switchToRemote = (branch: GitRemoteBranch): void => withRoot((path) => ({ type: 'git.switch', path, reference: branch.name, target: GitSwitchTarget.Remote }))

export const activateBranch = (branch: GitBranch): void => {
  if (!branch.current) {
    switchToBranch(branch)
  } else if (branch.upstream) {
    pullBranch()
  }
}

export const activateRemote = (branch: GitRemoteBranch): void => {
  if (useGitStore.getState().state?.head.upstream === branch.name) {
    pullBranch()
  } else {
    switchToRemote(branch)
  }
}

export const promptNewBranch = (start?: string, startLabel?: string): void =>
  useGitStore.getState().setPrompt({ kind: GitPromptKind.NewBranch, label: `Nouvelle branche depuis « ${startLabel ?? currentBranchName()} »`, initial: '', target: start, checkout: true })

export const promptRenameBranch = (branch: GitBranch): void =>
  useGitStore.getState().setPrompt({ kind: GitPromptKind.RenameBranch, label: `Renommer « ${branch.name} »`, initial: branch.name, target: branch.name, checkout: false })

export const promptNewTag = (commit?: string, label?: string): void =>
  useGitStore.getState().setPrompt({ kind: GitPromptKind.NewTag, label: `Nouveau tag sur ${label ?? `« ${currentBranchName()} »`}`, initial: '', target: commit, checkout: false })

export const promptStash = (): void => useGitStore.getState().setPrompt({ kind: GitPromptKind.Stash, label: 'Message du stash (facultatif)', initial: '', checkout: false })

export const promptStashFiles = (files: string[]): void =>
  useGitStore.getState().setPrompt({ kind: GitPromptKind.Stash, label: `Message du stash de ${plural(files.length, 'fichier', 'fichiers')} (facultatif)`, initial: '', files, checkout: false })

export const submitPrompt = (value: string, checkout: boolean): void => {
  const { prompt, setPrompt } = useGitStore.getState()
  const name = value.trim()
  setPrompt(null)
  if (!prompt) {
    return
  }
  const target = prompt.target
  switch (prompt.kind) {
    case GitPromptKind.NewBranch:
      if (name) {
        withRoot((path) => ({ type: 'git.branchCreate', path, name, reference: target, checkout }))
      }
      break
    case GitPromptKind.RenameBranch:
      if (name && target && name !== target) {
        withRoot((path) => ({ type: 'git.branchRename', path, name: target, newName: name }))
      }
      break
    case GitPromptKind.NewTag:
      if (name) {
        withRoot((path) => ({ type: 'git.tagCreate', path, name, commit: target ?? 'HEAD' }))
      }
      break
    case GitPromptKind.Stash:
      withRoot((path) => ({ type: 'git.stash', path, message: name, files: prompt.files ?? [] }))
      break
  }
}

const confirmForcedDelete = (branch: GitBranch): void =>
  askConfirmation({
    title: `Supprimer « ${branch.name} » sans merge ?`,
    body: 'Ses commits ne sont ni dans la branche courante ni dans sa branche distante : ils ne seront plus visibles dans le graphe.',
    detail: '« Annuler » dans la vue Git peut recréer la branche tant qu’aucune autre opération n’est faite.',
    confirmLabel: 'Supprimer',
    run: () => withRoot((path) => ({ type: 'git.branchDelete', path, name: branch.name, force: true, confirmed: true })),
  })

export const deleteBranch = (branch: GitBranch): void => {
  if (!branch.merged) {
    confirmForcedDelete(branch)
    return
  }
  retryOnFailure('git.branchDelete', () => confirmForcedDelete(branch))
  withRoot((path) => ({ type: 'git.branchDelete', path, name: branch.name, force: false, confirmed: false }))
}

export const deleteRemoteBranch = (branch: GitRemoteBranch): void =>
  askConfirmation({
    title: `Supprimer la branche distante « ${branch.name} » ?`,
    body: `La branche « ${branch.branch} » sera supprimée sur ${branch.remote}, pour tous ceux qui l’utilisent.`,
    detail: 'Cette suppression est publiée : elle ne peut pas être annulée depuis Tily.',
    confirmLabel: 'Supprimer sur le distant',
    run: () => withRoot((path) => ({ type: 'git.remoteBranchDelete', path, reference: branch.name, confirmed: true })),
  })

export const deleteTag = (tag: GitTag): void => withRoot((path) => ({ type: 'git.tagDelete', path, name: tag.name }))

export const pushTag = (tag: GitTag): void => withRoot((path) => ({ type: 'git.tagPush', path, name: tag.name }))

export const pushBranchUpTo = (branch: string, commit?: string): void => withRoot((path) => ({ type: 'git.pushBranch', path, branch, commit }))

export const applyStash = (stash: GitStash, pop: boolean): void => withRoot((path) => ({ type: 'git.stashApply', path, index: stash.index, commit: stash.sha, pop }))

export const dropStash = (stash: GitStash): void =>
  askConfirmation({
    title: 'Supprimer ce stash ?',
    body: 'Les modifications de ce stash seront supprimées.',
    detail: `${stash.message}\n« Annuler » dans la vue Git peut le restaurer tant qu’aucune autre opération n’est faite.`,
    confirmLabel: 'Supprimer',
    run: () => withRoot((path) => ({ type: 'git.stashDrop', path, index: stash.index, commit: stash.sha, confirmed: true })),
  })
