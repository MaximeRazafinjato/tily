import { bridge } from '../bridge/bridge'
import { GitConflictResolution, GitFailureCode, type GitConflict, type GitConflictFile, type GitState } from '../bridge/gitMessages'
import { useGitStore } from '../store/gitStore'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { focusGitPanel } from './gitFocus'
import { fileName, plural } from './gitLabels'
import { askConfirmation, closeDrawer, retryOnFailure, withRoot } from './gitRequests'

let lastRequest = 0
let dirty = false

export const markConflictDirty = (): void => {
  dirty = true
}

const requestConflict = (file: string): void => {
  const path = useGitStore.getState().state?.root
  if (path) {
    const request = ++lastRequest
    dirty = false
    useGitStore.getState().showConflict(file, request)
    bridge.send({ type: 'git.conflict', path, request, file })
  }
}

export const guardConflictEdits = (run: () => void): void => {
  if (!dirty || useGitStore.getState().conflictPath === null) {
    run()
    return
  }
  askConfirmation({
    title: 'Abandonner la résolution en cours ?',
    body: 'Les choix faits dans le résolveur de conflits n’ont pas été enregistrés.',
    confirmLabel: 'Abandonner',
    run: () => {
      dirty = false
      run()
    },
  })
}

export const openConflict = (conflict: GitConflict): void => {
  const { conflictPath, conflictError } = useGitStore.getState()
  if (conflictPath !== conflict.path || conflictError) {
    guardConflictEdits(() => requestConflict(conflict.path))
  }
}

export const closeConflict = (): void =>
  guardConflictEdits(() => {
    closeDrawer()
    focusGitPanel()
  })

const retryMessage = (code: GitFailureCode, name: string) =>
  code === GitFailureCode.FileChanged
    ? { title: `Remplacer « ${name} » modifié sur le disque ?`, body: 'Le fichier a changé depuis l’ouverture du résolveur : ces modifications seront remplacées par le résultat.' }
    : { title: `Enregistrer « ${name} » malgré les marqueurs ?`, body: 'Le résultat contient encore des lignes de marqueurs de conflit (<<<<<<< ou >>>>>>>).' }

export const saveConflictResult = (content: string, unresolved: number): void => {
  const file = useGitStore.getState().conflictFile
  if (!file) {
    return
  }
  if (unresolved > 0) {
    useHostStore.getState().setStatus(`Encore ${plural(unresolved, 'conflit', 'conflits')} à résoudre dans « ${fileName(file.path)} ».`, StatusLevel.Warning)
    return
  }
  const send = (confirmed: boolean) => withRoot((path) => ({ type: 'git.resolveText', path, file: file.path, content, version: file.version ?? null, confirmed }), false)
  retryOnFailure('git.resolveText', (code) => askConfirmation({ ...retryMessage(code, fileName(file.path)), detail: file.path, confirmLabel: 'Enregistrer', run: () => send(true) }))
  send(false)
}

const sideSuffix = (name: string | null | undefined): string => (name ? ` (${name})` : '')

const TAKE_TITLES: Record<GitConflictResolution, (name: string, file: GitConflictFile) => string> = {
  [GitConflictResolution.Ours]: (name, { sides }) => `Garder la version courante${sideSuffix(sides.ours)} de « ${name} » ?`,
  [GitConflictResolution.Theirs]: (name, { sides }) => `Garder la version entrante${sideSuffix(sides.theirs)} de « ${name} » ?`,
  [GitConflictResolution.Delete]: (name) => `Supprimer « ${name} » ?`,
}

const TAKE_LABELS: Record<GitConflictResolution, string> = {
  [GitConflictResolution.Ours]: 'Garder cette version',
  [GitConflictResolution.Theirs]: 'Garder cette version',
  [GitConflictResolution.Delete]: 'Supprimer',
}

export const takeConflictSide = (resolution: GitConflictResolution): void => {
  const file = useGitStore.getState().conflictFile
  if (!file) {
    return
  }
  askConfirmation({
    title: TAKE_TITLES[resolution](fileName(file.path), file),
    body: resolution === GitConflictResolution.Delete ? 'Le fichier est supprimé et le conflit marqué résolu.' : 'Le fichier prend entièrement cette version et le conflit est marqué résolu ; les choix faits dans le résolveur sont perdus.',
    detail: file.path,
    confirmLabel: TAKE_LABELS[resolution],
    run: () => {
      dirty = false
      withRoot((path) => ({ type: 'git.takeSide', path, file: file.path, mode: resolution, confirmed: true }), false)
    },
  })
}

export const followShownConflict = (previous: GitState | null, state: GitState): void => {
  const { conflictPath } = useGitStore.getState()
  if (conflictPath === null || state.conflicts.some((conflict) => conflict.path === conflictPath)) {
    return
  }
  dirty = false
  const before = previous?.conflicts ?? []
  const index = before.findIndex((conflict) => conflict.path === conflictPath)
  const remaining = (conflict: GitConflict) => state.conflicts.find((candidate) => candidate.path === conflict.path)
  const next = before.slice(index + 1).map(remaining).find(Boolean) ?? before.slice(0, Math.max(index, 0)).map(remaining).find(Boolean) ?? state.conflicts[0]
  if (next) {
    requestConflict(next.path)
  } else {
    closeDrawer()
    focusGitPanel()
  }
}

export const receiveGitConflict = (request: number, file: GitConflictFile | undefined, error: string | undefined): void =>
  useGitStore.getState().receiveConflict(request, file ?? null, error ?? null)
