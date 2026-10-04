import { BrowserViewport, pageName, PaneKind } from './browser'

export enum SplitAxis {
  Horizontal = 'x',
  Vertical = 'y',
}

export interface Pane {
  id: string
  path: string
  shell: string
  owner?: string
  kind?: PaneKind
  url?: string
  viewport?: BrowserViewport
}

export interface SplitLeaf {
  pane: Pane
}

interface SplitBranch {
  axis: SplitAxis
  ratio: number
  a: SplitNode
  b: SplitNode
}

export type SplitNode = SplitLeaf | SplitBranch

export enum SplitSide {
  A = 'a',
  B = 'b',
}

export type SplitPath = SplitSide[]

export enum RightPanelView {
  Files = 'files',
  Git = 'git',
  Notes = 'notes',
}

export interface Tab {
  id: string
  name: string
  manual: boolean
  active: string
  tree: SplitNode
  explorer?: boolean
  panel?: RightPanelView
  owner?: string
}

export interface Workspace {
  id: string
  name: string
  tabs: Tab[]
  active: string
  expanded?: boolean
  note?: string
}

export interface ClosedTab {
  workspaceId: string
  workspaceName: string
  index: number
  tab: Tab
  workspaceNote?: string
}

export interface GitGraphLayout {
  referencesWidth: number
  referencesOpen: boolean
  labelsWidth: number
  graphWidth: number
  authorWidth: number
  dateWidth: number
  authorShown: boolean
  dateShown: boolean
}

export interface Session {
  version: number
  workspaces: Workspace[]
  active: string
  sidebar: number
  sidebarCollapsed: boolean
  explorerWidth: number
  gitGraph: GitGraphLayout
  closed: ClosedTab[]
  favorites: string[]
}

export const SIDEBAR_MIN = 220
export const SIDEBAR_MAX = 450
export const SIDEBAR_DEFAULT = 292
export const EXPLORER_MIN = 200
export const EXPLORER_MAX = 600
export const EXPLORER_DEFAULT = 280
export const GIT_REFERENCES_MIN = 160
export const GIT_REFERENCES_MAX = 420
export const GIT_COLUMN_MIN = 48
export const GIT_COLUMN_MAX = 480
export const DEFAULT_GIT_GRAPH: GitGraphLayout = {
  referencesWidth: 200,
  referencesOpen: true,
  labelsWidth: 140,
  graphWidth: 100,
  authorWidth: 130,
  dateWidth: 120,
  authorShown: true,
  dateShown: true,
}
export const DEFAULT_SHELL = 'powershell'
export const CLOSED_TABS_MAX = 5
export const FAVORITES_MAX = 50
export const NOTE_MAX_CHARS = 100_000
const NOTE_PREVIEW_CHARS = 80
export const SPLIT_RATIO_MIN = 0.15
export const SPLIT_RATIO_MAX = 0.85
export const SPLIT_RATIO_DEFAULT = 0.5

const clampRatio = (ratio: number): number => Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, ratio))

const clampWidth = (width: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(width)))

export const clampGitGraph = (layout: GitGraphLayout): GitGraphLayout => ({
  ...layout,
  referencesWidth: clampWidth(layout.referencesWidth, GIT_REFERENCES_MIN, GIT_REFERENCES_MAX),
  labelsWidth: clampWidth(layout.labelsWidth, GIT_COLUMN_MIN, GIT_COLUMN_MAX),
  graphWidth: clampWidth(layout.graphWidth, GIT_COLUMN_MIN, GIT_COLUMN_MAX),
  authorWidth: clampWidth(layout.authorWidth, GIT_COLUMN_MIN, GIT_COLUMN_MAX),
  dateWidth: clampWidth(layout.dateWidth, GIT_COLUMN_MIN, GIT_COLUMN_MAX),
})

export const notePreview = (note: string | undefined): string => {
  const line = (note ?? '').split(/\r?\n/).map((candidate) => candidate.trim()).find((candidate) => candidate.length > 0) ?? ''
  return line.length > NOTE_PREVIEW_CHARS ? `${line.slice(0, NOTE_PREVIEW_CHARS - 1)}…` : line
}

export const distinctWorkspaceName = (workspaces: Workspace[], workspace: Workspace): string =>
  workspaces.some((other) => other !== workspace && other.name === workspace.name) ? `${workspace.name} (workspace ${workspaces.indexOf(workspace) + 1})` : workspace.name

export const mergedNote = (note: string | undefined, movedFrom: string, moved: string): string =>
  (note ? `${note}\n\n${movedFrom} :\n${moved}` : moved).slice(0, NOTE_MAX_CHARS)

export const isLeaf = (node: SplitNode): node is SplitLeaf => 'pane' in node

const newId = (): string => crypto.randomUUID().replace(/-/g, '')

export const folderName = (path: string): string => {
  const trimmed = path.replace(/[\\/]+$/, '')
  const segment = trimmed.split(/[\\/]/).pop()
  return segment && segment.length > 0 ? segment : trimmed
}

export const createPane = (path: string, shell: string): Pane => ({ id: newId(), path, shell })

export const isBrowserPane = (pane: Pane): boolean => pane.kind === PaneKind.Browser

export const createBrowserPane = (path: string, shell: string, url: string, viewport = BrowserViewport.Desktop): Pane => ({ ...createPane(path, shell), kind: PaneKind.Browser, url, viewport })

export const paneName = (pane: Pane): string => (isBrowserPane(pane) ? pageName(pane.url) : folderName(pane.path) || pane.shell)

export const tabNameFor = (tab: Tab, paneId: string, path: string): string => (!tab.manual && tab.active === paneId ? folderName(path) || tab.name : tab.name)

export const tabOfPane = (pane: Pane): Tab => ({ id: newId(), name: paneName(pane), manual: false, active: pane.id, tree: { pane } })

export const createTab = (path: string, shell: string): Tab => tabOfPane(createPane(path, shell))

export const createWorkspace = (name: string, path: string, shell: string): Workspace => {
  const tab = createTab(path, shell)
  return { id: newId(), name, tabs: [tab], active: tab.id, expanded: true }
}

export const createOwnedPane = (path: string, shell: string, owner: string): Pane => ({ ...createPane(path, shell), owner })

export const createOwnedBrowserPane = (path: string, shell: string, url: string, viewport: BrowserViewport, owner: string): Pane => ({ ...createBrowserPane(path, shell, url, viewport), owner })

export const createOwnedTab = (path: string, shell: string, owner: string): Tab => ({ ...tabOfPane(createOwnedPane(path, shell, owner)), owner })

export const createOwnedWorkspace = (name: string, path: string, shell: string, owner: string): Workspace => {
  const tab = createOwnedTab(path, shell, owner)
  return { id: newId(), name, tabs: [tab], active: tab.id, expanded: true }
}

export const panesOf = (node: SplitNode): Pane[] => (isLeaf(node) ? [node.pane] : [...panesOf(node.a), ...panesOf(node.b)])

const replaceNode = (node: SplitNode, paneId: string, replacement: (leaf: SplitLeaf) => SplitNode): SplitNode => {
  if (isLeaf(node)) {
    return node.pane.id === paneId ? replacement(node) : node
  }
  const a = replaceNode(node.a, paneId, replacement)
  const b = replaceNode(node.b, paneId, replacement)
  return a === node.a && b === node.b ? node : { ...node, a, b }
}

export const pruneNode = (node: SplitNode, paneId: string): SplitNode | null => {
  if (isLeaf(node)) {
    return node.pane.id === paneId ? null : node
  }
  const a = pruneNode(node.a, paneId)
  const b = pruneNode(node.b, paneId)
  if (a && b) {
    return { ...node, a, b }
  }
  return a ?? b
}

export const updatePane = (node: SplitNode, paneId: string, patch: Partial<Pane>): SplitNode =>
  replaceNode(node, paneId, (leaf) => ({ pane: { ...leaf.pane, ...patch } }))

export const splitLeaf = (node: SplitNode, paneId: string, axis: SplitAxis, pane: Pane): SplitNode =>
  replaceNode(node, paneId, (leaf): SplitNode => ({ axis, ratio: SPLIT_RATIO_DEFAULT, a: leaf, b: { pane } }))

const swappedLeaf = (leaf: SplitLeaf, first: Pane, second: Pane): SplitLeaf => {
  if (leaf.pane.id === first.id) {
    return { pane: second }
  }
  return leaf.pane.id === second.id ? { pane: first } : leaf
}

const mapLeaves = (node: SplitNode, map: (leaf: SplitLeaf) => SplitLeaf): SplitNode =>
  isLeaf(node) ? map(node) : { ...node, a: mapLeaves(node.a, map), b: mapLeaves(node.b, map) }

export const swapPanes = (node: SplitNode, firstId: string, secondId: string): SplitNode => {
  const panes = panesOf(node)
  const first = panes.find((pane) => pane.id === firstId)
  const second = panes.find((pane) => pane.id === secondId)
  return first && second && first !== second ? mapLeaves(node, (leaf) => swappedLeaf(leaf, first, second)) : node
}

export const setRatioAt = (node: SplitNode, path: SplitPath, ratio: number): SplitNode => {
  if (isLeaf(node)) {
    return node
  }
  const [side, ...rest] = path
  if (side === undefined) {
    return { ...node, ratio: clampRatio(ratio) }
  }
  return { ...node, [side]: setRatioAt(node[side], rest, ratio) }
}

const spanAlong = (node: SplitNode, axis: SplitAxis): number => {
  if (isLeaf(node)) {
    return 1
  }
  const a = spanAlong(node.a, axis)
  const b = spanAlong(node.b, axis)
  return node.axis === axis ? a + b : Math.max(a, b)
}

export const equalizeNode = (node: SplitNode): SplitNode => {
  if (isLeaf(node)) {
    return node
  }
  const a = equalizeNode(node.a)
  const b = equalizeNode(node.b)
  const spanA = spanAlong(a, node.axis)
  const ratio = clampRatio(spanA / (spanA + spanAlong(b, node.axis)))
  return a === node.a && b === node.b && ratio === node.ratio ? node : { ...node, ratio, a, b }
}

const renewPaneIds = (node: SplitNode, paneIds: Record<string, string>): SplitNode => {
  if (isLeaf(node)) {
    const id = newId()
    paneIds[node.pane.id] = id
    return { pane: { ...node.pane, id } }
  }
  return { ...node, a: renewPaneIds(node.a, paneIds), b: renewPaneIds(node.b, paneIds) }
}

const disownNode = (node: SplitNode): SplitNode => {
  if (isLeaf(node)) {
    const { owner: _owner, ...pane } = node.pane
    return { pane }
  }
  return { ...node, a: disownNode(node.a), b: disownNode(node.b) }
}

export const disownTab = (tab: Tab): Tab => {
  const { owner: _owner, ...rest } = tab
  return { ...rest, tree: disownNode(tab.tree) }
}

export const cloneTabWithNewIds = (tab: Tab): { tab: Tab; paneIds: Record<string, string> } => {
  const paneIds: Record<string, string> = {}
  const tree = renewPaneIds(tab.tree, paneIds)
  return { tab: { ...tab, id: newId(), tree, active: paneIds[tab.active] ?? panesOf(tree)[0].id }, paneIds }
}

export const isManuallyNamed = (session: Session | null, tabId: string): boolean =>
  session?.workspaces.some((workspace) => workspace.tabs.some((tab) => tab.id === tabId && tab.manual)) ?? false

export const findWorkspace = (session: Session, workspaceId: string): Workspace | undefined =>
  session.workspaces.find((workspace) => workspace.id === workspaceId)

export const activeWorkspace = (session: Session): Workspace | undefined =>
  findWorkspace(session, session.active) ?? session.workspaces[0]

export const activeTab = (workspace: Workspace): Tab =>
  workspace.tabs.find((tab) => tab.id === workspace.active) ?? workspace.tabs[0]

const countLabel = (count: number, one: string, several: string): string => `${count} ${count === 1 ? one : several}`

export const restoredSessionLabel = (session: Session): string => {
  const tabs = session.workspaces.reduce((total, workspace) => total + workspace.tabs.length, 0)
  return session.workspaces.length === 0 ? '' : ` (${countLabel(session.workspaces.length, 'workspace', 'workspaces')}, ${countLabel(tabs, 'onglet', 'onglets')})`
}

export const paneCountLabel = (count: number): string => (count === 1 ? '1 pane' : `${count} panes`)

export const activePane = (tab: Tab): Pane => panesOf(tab.tree).find((pane) => pane.id === tab.active) ?? panesOf(tab.tree)[0]

export const findPane = (session: Session, paneId: string): Pane | undefined => allPanes(session).find((pane) => pane.id === paneId)

export const allPanes = (session: Session): Pane[] =>
  session.workspaces.flatMap((workspace) => workspace.tabs.flatMap((tab) => panesOf(tab.tree)))
