import { focusActivePane, focusFileRow, focusFileTree } from '../explorer/fileExplorerActions'
import { GitDiffSource, type GitFileChange, type GitState } from '../bridge/gitMessages'
import { focusGitPanel, requestGraphFocus } from '../git/gitFocus'
import { absolutePath } from '../git/gitLabels'
import { showChange } from '../git/gitRequests'
import { activePane, activeTab, activeWorkspace, RightPanelView } from '../model/session'
import { useExplorerStore } from '../store/explorerStore'
import { useGitStore } from '../store/gitStore'
import { useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'

const PANEL_SELECTOR = '[data-right-panel], [data-git-graph]'
const NOTE_SELECTOR = '[data-workspace-note]'
const BACKSLASH = '\\'
const TRAILING_SEPARATORS = /\\+$/

const focusGit = (): void => (useGitStore.getState().graphOpen ? requestGraphFocus() : focusGitPanel())

const focusNotes = (): void => document.querySelector<HTMLTextAreaElement>(NOTE_SELECTOR)?.focus()

const focusView = (view: RightPanelView): void => {
  if (view === RightPanelView.Git) {
    focusGit()
  } else if (view === RightPanelView.Notes) {
    focusNotes()
  } else {
    focusFileTree()
  }
}

const focusIsInPanel = (): boolean => Boolean(document.activeElement?.closest(PANEL_SELECTOR))

export const togglePanelView = (view: RightPanelView, focusPanel: boolean): void => {
  const leaving = focusIsInPanel()
  if (view === RightPanelView.Git) {
    useGitStore.getState().setGraphOpen(true)
  }
  const opened = useSessionStore.getState().togglePanelView(view)
  if (opened && focusPanel) {
    requestAnimationFrame(() => focusView(view))
  } else if (!opened && (leaving || focusPanel)) {
    focusActivePane()
  }
}

export const toggleRightPanel = (): void => {
  const leaving = focusIsInPanel()
  useGitStore.getState().setGraphOpen(true)
  if (!useSessionStore.getState().toggleExplorer() && leaving) {
    focusActivePane()
  }
}

const showPanelView = (view: RightPanelView): void => {
  if (view === RightPanelView.Git) {
    useGitStore.getState().setGraphOpen(true)
  }
  useSessionStore.getState().setPanelView(view)
  requestAnimationFrame(() => focusView(view))
}

export const openPanelView = (view: RightPanelView): void => {
  const { session, toggleExplorer } = useSessionStore.getState()
  const workspace = session ? activeWorkspace(session) : undefined
  if (workspace && !activeTab(workspace).explorer) {
    toggleExplorer()
  }
  showPanelView(view)
}

const REVEAL_RETRY_MS = 50
const REVEAL_ATTEMPTS = 40

const FILE_TREE_SELECTOR = '[data-file-tree]'
let revealGeneration = 0
let changeGeneration = 0

const focusIsFree = (): boolean => document.activeElement === document.body || Boolean(document.activeElement?.closest(FILE_TREE_SELECTOR))

const focusRevealedRow = (path: string, attempts: number, generation: number): void => {
  if (generation !== revealGeneration || !focusIsFree()) {
    return
  }
  if (!focusFileRow(path) && attempts > 1) {
    setTimeout(() => focusRevealedRow(path, attempts - 1, generation), REVEAL_RETRY_MS)
  }
}

const withBackslashes = (path: string): string => path.replaceAll('/', BACKSLASH).replace(TRAILING_SEPARATORS, '')

export const revealInFileTree = (path: string): boolean => {
  const { session } = useSessionStore.getState()
  const workspace = session ? activeWorkspace(session) : undefined
  if (!workspace) {
    return false
  }
  const root = withBackslashes(activePane(activeTab(workspace)).path)
  const target = withBackslashes(path)
  if (!target.toLowerCase().startsWith(`${root.toLowerCase()}${BACKSLASH}`)) {
    useHostStore.getState().setStatus(`Fichier hors du dossier affiché par l’arbre des fichiers (${root}) : ${target}`)
    return false
  }
  const segments = target.slice(root.length + 1).split(BACKSLASH)
  const explorer = useExplorerStore.getState()
  segments.slice(0, -1).reduce((folder, segment) => {
    const next = `${folder}${BACKSLASH}${segment}`
    explorer.setExpanded(next, true)
    return next
  }, root)
  const file = `${root}${BACKSLASH}${segments.join(BACKSLASH)}`
  explorer.select(file)
  openPanelView(RightPanelView.Files)
  revealGeneration += 1
  const generation = revealGeneration
  setTimeout(() => focusRevealedRow(file, REVEAL_ATTEMPTS, generation), REVEAL_RETRY_MS)
  return true
}

const CHANGE_ATTEMPTS = 60

const showFoundChange = (target: string, attempts: number, generation: number, stale: GitState | null): void => {
  if (generation !== changeGeneration) {
    return
  }
  const { state, displayRoot } = useGitStore.getState()
  const current = state === stale ? null : state
  const root = current ? (displayRoot ?? current.root) : ''
  const find = (changes: GitFileChange[]): GitFileChange | undefined => changes.find((change) => withBackslashes(absolutePath(root, change.path)).toLowerCase() === target)
  const unstaged = find(current?.unstaged ?? [])
  const change = unstaged ?? find(current?.staged ?? [])
  if (change) {
    showChange(change, unstaged ? GitDiffSource.Unstaged : GitDiffSource.Staged)
  } else if (attempts > 1) {
    setTimeout(() => showFoundChange(target, attempts - 1, generation, stale), REVEAL_RETRY_MS)
  } else {
    useHostStore.getState().setStatus('Aucune modification Git de ce fichier à afficher.')
  }
}

export const showFileChanges = (path: string): void => {
  const { path: followed, state } = useGitStore.getState()
  const stale = followed === '' ? state : null
  showPanelView(RightPanelView.Git)
  changeGeneration += 1
  showFoundChange(withBackslashes(path).toLowerCase(), CHANGE_ATTEMPTS, changeGeneration, stale)
}

export const openWorkspaceNotes = (workspaceId: string): void => {
  const store = useSessionStore.getState()
  store.selectWorkspace(workspaceId)
  const session = useSessionStore.getState().session
  const workspace = session ? activeWorkspace(session) : undefined
  if (workspace && !activeTab(workspace).explorer) {
    store.toggleExplorer()
  }
  showPanelView(RightPanelView.Notes)
}

const showGitGraph = (): void => {
  useGitStore.getState().setGraphOpen(true)
  requestAnimationFrame(requestGraphFocus)
}

export const hideGitGraph = (): void => {
  useGitStore.getState().setGraphOpen(false)
  focusActivePane()
}

export const toggleGitGraph = (): void => (useGitStore.getState().graphOpen ? hideGitGraph() : showGitGraph())
