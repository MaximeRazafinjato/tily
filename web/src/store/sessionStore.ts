import { current, produce } from 'immer'
import { create } from 'zustand'
import type { BrowserViewport } from '../model/browser'
import { insertPaneBesideIn, setBrowserPageIn, setPaneViewportIn } from './browserPanes'
import { movePaneInto, movePaneOut } from './paneMoves'
import {
  activePane,
  activeTab,
  activeWorkspace,
  CLOSED_TABS_MAX,
  clampGitGraph,
  cloneTabWithNewIds,
  createPane,
  createTab,
  tabNameFor,
  createWorkspace,
  DEFAULT_GIT_GRAPH,
  disownTab,
  EXPLORER_DEFAULT,
  EXPLORER_MAX,
  EXPLORER_MIN,
  findWorkspace,
  mergedNote,
  NOTE_MAX_CHARS,
  panesOf,
  pruneNode,
  setRatioAt,
  equalizeNode,
  swapPanes,
  splitLeaf,
  updatePane,
  paneName,
  tabOfPane,
  RightPanelView,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  SplitAxis,
  type ClosedTab,
  type GitGraphLayout,
  type Pane,
  type Session,
  type SplitPath,
  type Tab,
  type Workspace,
} from '../model/session'

interface SessionState {
  session: Session | null
  load: (session: Session) => void
  change: (mutate: (draft: Session) => void) => void
  selectWorkspace: (workspaceId: string) => void
  selectTab: (tabId: string) => void
  selectPane: (paneId: string) => void
  toggleWorkspace: (workspaceId: string) => void
  collapseOtherWorkspaces: (workspaceId: string) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleExplorer: () => boolean
  togglePanelView: (view: RightPanelView) => boolean
  setPanelView: (view: RightPanelView) => void
  setExplorerWidth: (width: number) => void
  setGitGraphLayout: (change: Partial<GitGraphLayout>) => void
  newWorkspace: (name: string, path: string, shell: string) => string
  renameWorkspace: (workspaceId: string, name: string) => void
  setWorkspaceNote: (workspaceId: string, note: string) => void
  moveWorkspace: (workspaceId: string, offset: number) => void
  moveWorkspaceBefore: (workspaceId: string, beforeWorkspaceId?: string) => void
  newTab: (shell: string) => void
  newTabAt: (path: string, shell: string) => void
  renameTab: (tabId: string, name: string) => void
  resetTabName: (tabId: string) => void
  moveTab: (tabId: string, targetWorkspaceId: string, beforeTabId?: string) => void
  moveActiveTab: (offset: number) => void
  shiftTab: (tabId: string, offset: number) => void
  duplicateTab: (tabId: string) => void
  selectAdjacentTab: (offset: number) => void
  closeTab: (tabId: string) => void
  restoreTab: (position?: number) => { tab: Tab; paneIds: Record<string, string> } | null
  splitPane: (axis: SplitAxis) => void
  insertPaneBeside: (paneId: string, axis: SplitAxis, pane: Pane) => void
  newTabWithPane: (pane: Pane) => void
  setBrowserPage: (paneId: string, url: string, title: string) => void
  setPaneViewport: (paneId: string, viewport: BrowserViewport) => void
  setSplitRatio: (tabId: string, path: SplitPath, ratio: number) => void
  equalizeSplits: (tabId: string) => void
  swapActivePane: (targetPaneId: string) => void
  movePaneToNewTab: (paneId: string) => void
  movePaneToTab: (paneId: string, targetTabId: string) => void
  closePane: (paneId: string) => void
  setPanePath: (paneId: string, path: string) => void
  setPaneShell: (paneId: string, shell: string) => void
  toggleFavorite: (commandId: string) => void
  setFavorites: (commandIds: string[]) => void
}

const mutateSession = (session: Session | null, mutate: (draft: Session) => void): Session | null => (session ? produce(session, mutate) : session)

const mutateWorkspace = (session: Session | null, mutate: (workspace: Workspace, draft: Session) => void): Session | null =>
  mutateSession(session, (draft) => {
    const workspace = activeWorkspace(draft)
    if (workspace) {
      mutate(workspace, draft)
    }
  })

const mutateTab = (session: Session | null, mutate: (tab: Tab, workspace: Workspace, draft: Session) => void): Session | null =>
  mutateWorkspace(session, (workspace, draft) => mutate(activeTab(workspace), workspace, draft))


const rightPanelOpen = (session: Session | null): boolean => {
  const workspace = session ? activeWorkspace(session) : undefined
  return Boolean(workspace && activeTab(workspace).explorer)
}

const pathChanges = (session: Session | null, paneId: string, path: string): boolean =>
  (session?.workspaces ?? []).some((workspace) =>
    workspace.tabs.some((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId && (pane.path !== path || tabNameFor(tab, paneId, path) !== tab.name))),
  )

export const useSessionStore = create<SessionState>()((set, get) => ({
  session: null,

  load: (session) =>
    set({ session: { ...session, closed: session.closed ?? [], favorites: session.favorites ?? [], explorerWidth: session.explorerWidth ?? EXPLORER_DEFAULT, gitGraph: clampGitGraph({ ...DEFAULT_GIT_GRAPH, ...session.gitGraph }) } }),

  change: (mutate) => set((state) => ({ session: mutateSession(state.session, mutate) })),

  selectWorkspace: (workspaceId) =>
    set((state) => ({ session: mutateSession(state.session, (draft) => { draft.active = workspaceId }) })),

  selectTab: (tabId) =>
    set((state) => ({ session: mutateWorkspace(state.session, (workspace) => { workspace.active = tabId }) })),

  selectPane: (paneId) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        for (const workspace of draft.workspaces) {
          for (const tab of workspace.tabs) {
            if (panesOf(tab.tree).some((pane) => pane.id === paneId)) {
              draft.active = workspace.id
              workspace.active = tab.id
              tab.active = paneId
            }
          }
        }
      }),
    })),

  toggleWorkspace: (workspaceId) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const workspace = draft.workspaces.find((candidate) => candidate.id === workspaceId)
        if (workspace) {
          workspace.expanded = !(workspace.expanded ?? workspace.id === draft.active)
        }
      }),
    })),

  collapseOtherWorkspaces: (workspaceId) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        for (const workspace of draft.workspaces) {
          if (workspace.id !== workspaceId && (workspace.expanded ?? workspace.id === draft.active)) {
            workspace.expanded = false
          }
        }
      }),
    })),

  toggleSidebar: () =>
    set((state) => ({ session: mutateSession(state.session, (draft) => { draft.sidebarCollapsed = !draft.sidebarCollapsed }) })),

  setSidebarWidth: (width) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => { draft.sidebar = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width))) }),
    })),

  toggleExplorer: () => {
    set((state) => ({ session: mutateTab(state.session, (tab) => { tab.explorer = !tab.explorer }) }))
    return rightPanelOpen(get().session)
  },

  togglePanelView: (view) => {
    set((state) => ({
      session: mutateTab(state.session, (tab) => {
        const shown = tab.explorer && (tab.panel ?? RightPanelView.Files) === view
        tab.explorer = !shown
        tab.panel = view
      }),
    }))
    return rightPanelOpen(get().session)
  },

  setPanelView: (view) =>
    set((state) => ({ session: mutateTab(state.session, (tab) => { tab.panel = view }) })),

  setExplorerWidth: (width) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => { draft.explorerWidth = Math.min(EXPLORER_MAX, Math.max(EXPLORER_MIN, Math.round(width))) }),
    })),

  setGitGraphLayout: (change) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => { Object.assign(draft.gitGraph, clampGitGraph({ ...draft.gitGraph, ...change })) }),
    })),

  newWorkspace: (name, path, shell) => {
    const workspace = createWorkspace(name, path, shell)
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        draft.workspaces.push(workspace)
        draft.active = workspace.id
      }),
    }))
    return workspace.id
  },

  renameWorkspace: (workspaceId, name) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const workspace = findWorkspace(draft, workspaceId)
        const trimmed = name.trim()
        if (workspace && trimmed.length > 0) {
          workspace.name = trimmed
        }
      }),
    })),

  setWorkspaceNote: (workspaceId, note) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const workspace = findWorkspace(draft, workspaceId)
        if (workspace) {
          workspace.note = note.slice(0, NOTE_MAX_CHARS) || undefined
        }
      }),
    })),

  moveWorkspace: (workspaceId, offset) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const index = draft.workspaces.findIndex((workspace) => workspace.id === workspaceId)
        const destination = index + offset
        if (index < 0 || destination < 0 || destination >= draft.workspaces.length) {
          return
        }
        const [workspace] = draft.workspaces.splice(index, 1)
        draft.workspaces.splice(destination, 0, workspace)
      }),
    })),

  moveWorkspaceBefore: (workspaceId, beforeWorkspaceId) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const index = draft.workspaces.findIndex((workspace) => workspace.id === workspaceId)
        const before = beforeWorkspaceId ? draft.workspaces.findIndex((workspace) => workspace.id === beforeWorkspaceId) : draft.workspaces.length
        if (index < 0 || before < 0 || before === index || before === index + 1) {
          return
        }
        const [workspace] = draft.workspaces.splice(index, 1)
        draft.workspaces.splice(before > index ? before - 1 : before, 0, workspace)
      }),
    })),

  newTab: (shell) =>
    set((state) => ({
      session: mutateWorkspace(state.session, (workspace) => {
        const tab = createTab(activePane(activeTab(workspace)).path, shell)
        workspace.tabs.push(tab)
        workspace.active = tab.id
      }),
    })),

  newTabAt: (path, shell) =>
    set((state) => ({
      session: mutateWorkspace(state.session, (workspace) => {
        const tab = createTab(path, shell)
        workspace.tabs.push(tab)
        workspace.active = tab.id
      }),
    })),

  renameTab: (tabId, name) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const tab = draft.workspaces.flatMap((workspace) => workspace.tabs).find((candidate) => candidate.id === tabId)
        const trimmed = name.trim()
        if (tab && trimmed.length > 0) {
          tab.name = trimmed
          tab.manual = true
        }
      }),
    })),

  resetTabName: (tabId) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const tab = draft.workspaces.flatMap((workspace) => workspace.tabs).find((candidate) => candidate.id === tabId)
        if (tab) {
          tab.manual = false
          tab.name = paneName(activePane(tab)) || tab.name
        }
      }),
    })),

  moveTab: (tabId, targetWorkspaceId, beforeTabId) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const source = draft.workspaces.find((candidate) => candidate.tabs.some((tab) => tab.id === tabId))
        const target = findWorkspace(draft, targetWorkspaceId)
        if (!source || !target || tabId === beforeTabId) {
          return
        }
        const [tab] = source.tabs.splice(source.tabs.findIndex((candidate) => candidate.id === tabId), 1)
        if (source.tabs.length === 0 && source !== target) {
          if (source.note) {
            target.note = mergedNote(target.note, source.name, source.note)
          }
          draft.workspaces = draft.workspaces.filter((candidate) => candidate !== source)
        } else if (source.active === tabId && source !== target) {
          source.active = source.tabs[0].id
        }
        const index = beforeTabId ? target.tabs.findIndex((candidate) => candidate.id === beforeTabId) : -1
        target.tabs.splice(index < 0 ? target.tabs.length : index, 0, tab)
        target.active = tab.id
        draft.active = target.id
      }),
    })),

  moveActiveTab: (offset) =>
    set((state) => ({
      session: mutateWorkspace(state.session, (workspace) => {
        const index = workspace.tabs.findIndex((tab) => tab.id === workspace.active)
        const destination = index + offset
        if (destination < 0 || destination >= workspace.tabs.length) {
          return
        }
        const [tab] = workspace.tabs.splice(index, 1)
        workspace.tabs.splice(destination, 0, tab)
      }),
    })),

  shiftTab: (tabId, offset) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const workspace = draft.workspaces.find((candidate) => candidate.tabs.some((tab) => tab.id === tabId))
        const index = workspace ? workspace.tabs.findIndex((tab) => tab.id === tabId) : -1
        const destination = index + offset
        if (!workspace || index < 0 || destination < 0 || destination >= workspace.tabs.length) {
          return
        }
        const [tab] = workspace.tabs.splice(index, 1)
        workspace.tabs.splice(destination, 0, tab)
      }),
    })),

  duplicateTab: (tabId) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const workspace = draft.workspaces.find((candidate) => candidate.tabs.some((tab) => tab.id === tabId))
        const index = workspace ? workspace.tabs.findIndex((tab) => tab.id === tabId) : -1
        if (!workspace || index < 0) {
          return
        }
        const { tab } = cloneTabWithNewIds(disownTab(current(workspace.tabs[index])))
        workspace.tabs.splice(index + 1, 0, tab)
        workspace.active = tab.id
        draft.active = workspace.id
      }),
    })),

  selectAdjacentTab: (offset) =>
    set((state) => ({
      session: mutateWorkspace(state.session, (workspace) => {
        const count = workspace.tabs.length
        const index = Math.max(0, workspace.tabs.findIndex((tab) => tab.id === workspace.active))
        workspace.active = workspace.tabs[(((index + offset) % count) + count) % count].id
      }),
    })),

  closeTab: (tabId) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const workspace = draft.workspaces.find((candidate) => candidate.tabs.some((tab) => tab.id === tabId))
        if (!workspace) {
          return
        }
        const index = workspace.tabs.findIndex((tab) => tab.id === tabId)
        const [tab] = workspace.tabs.splice(index, 1)
        const closed: ClosedTab = { workspaceId: workspace.id, workspaceName: workspace.name, index, tab }
        if (workspace.tabs.length === 0 && workspace.note) {
          closed.workspaceNote = workspace.note
        }
        draft.closed = [...draft.closed, closed].slice(-CLOSED_TABS_MAX)
        if (workspace.tabs.length === 0) {
          draft.workspaces = draft.workspaces.filter((candidate) => candidate.id !== workspace.id)
          if (draft.active === workspace.id) {
            draft.active = draft.workspaces[0]?.id ?? ''
          }
          return
        }
        if (workspace.active === tabId) {
          workspace.active = workspace.tabs[Math.min(index, workspace.tabs.length - 1)].id
        }
      }),
    })),

  restoreTab: (position) => {
    const closed = get().session?.closed ?? []
    const index = position ?? closed.length - 1
    const entry = closed[index]
    if (!entry) {
      return null
    }
    const { tab, paneIds } = cloneTabWithNewIds(entry.tab)
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        draft.closed = draft.closed.filter((_, candidate) => candidate !== index)
        let workspace = findWorkspace(draft, entry.workspaceId)
        if (!workspace) {
          workspace = { id: entry.workspaceId, name: entry.workspaceName, tabs: [], active: tab.id, expanded: true }
          draft.workspaces.push(workspace)
        }
        if (entry.workspaceNote && !workspace.note) {
          workspace.note = entry.workspaceNote
        }
        workspace.tabs.splice(Math.min(entry.index, workspace.tabs.length), 0, tab)
        workspace.active = tab.id
        draft.active = workspace.id
      }),
    }))
    return { tab, paneIds }
  },

  splitPane: (axis) =>
    set((state) => ({
      session: mutateTab(state.session, (tab) => {
        const current = activePane(tab)
        const fresh = createPane(current.path, current.shell)
        tab.tree = splitLeaf(tab.tree, current.id, axis, fresh)
        tab.active = fresh.id
      }),
    })),

  insertPaneBeside: (paneId, axis, pane) => set((state) => ({ session: mutateSession(state.session, (draft) => insertPaneBesideIn(draft, paneId, axis, pane)) })),

  newTabWithPane: (pane) =>
    set((state) => ({
      session: mutateWorkspace(state.session, (workspace) => {
        const tab = tabOfPane(pane)
        workspace.tabs.push(tab)
        workspace.active = tab.id
      }),
    })),

  setBrowserPage: (paneId, url, title) => set((state) => ({ session: mutateSession(state.session, (draft) => setBrowserPageIn(draft, paneId, url, title)) })),

  setPaneViewport: (paneId, viewport) => set((state) => ({ session: mutateSession(state.session, (draft) => setPaneViewportIn(draft, paneId, viewport)) })),

  setSplitRatio: (tabId, path, ratio) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const tab = draft.workspaces.flatMap((workspace) => workspace.tabs).find((candidate) => candidate.id === tabId)
        if (tab) {
          tab.tree = setRatioAt(tab.tree, path, ratio)
        }
      }),
    })),

  equalizeSplits: (tabId) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        const tab = draft.workspaces.flatMap((workspace) => workspace.tabs).find((candidate) => candidate.id === tabId)
        if (tab) {
          tab.tree = equalizeNode(tab.tree)
        }
      }),
    })),

  swapActivePane: (targetPaneId) =>
    set((state) => ({
      session: mutateTab(state.session, (tab) => {
        tab.tree = swapPanes(tab.tree, tab.active, targetPaneId)
      }),
    })),

  movePaneToNewTab: (paneId) => set((state) => ({ session: mutateSession(state.session, (draft) => movePaneOut(draft, paneId)) })),

  movePaneToTab: (paneId, targetTabId) => set((state) => ({ session: mutateSession(state.session, (draft) => movePaneInto(draft, paneId, targetTabId)) })),

  closePane: (paneId) =>
    set((state) => {
      const session = state.session
      if (!session) {
        return {}
      }
      const workspace = session.workspaces.find((candidate) => candidate.tabs.some((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId)))
      const tab = workspace?.tabs.find((candidate) => panesOf(candidate.tree).some((pane) => pane.id === paneId))
      if (!workspace || !tab) {
        return {}
      }
      if (panesOf(tab.tree).length === 1) {
        state.closeTab(tab.id)
        return {}
      }
      return {
        session: mutateSession(session, (draft) => {
          const draftTab = draft.workspaces.find((candidate) => candidate.id === workspace.id)!.tabs.find((candidate) => candidate.id === tab.id)!
          draftTab.tree = pruneNode(draftTab.tree, paneId) ?? draftTab.tree
          if (draftTab.active === paneId) {
            draftTab.active = panesOf(draftTab.tree)[0].id
          }
        }),
      }
    }),

  toggleFavorite: (commandId) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        draft.favorites = draft.favorites.includes(commandId) ? draft.favorites.filter((candidate) => candidate !== commandId) : [...draft.favorites, commandId]
      }),
    })),

  setFavorites: (commandIds) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        draft.favorites = commandIds
      }),
    })),

  setPaneShell: (paneId, shell) =>
    set((state) => ({
      session: mutateSession(state.session, (draft) => {
        for (const workspace of draft.workspaces) {
          for (const tab of workspace.tabs) {
            tab.tree = updatePane(tab.tree, paneId, { shell })
          }
        }
      }),
    })),

  setPanePath: (paneId, path) =>
    set((state) =>
      pathChanges(state.session, paneId, path)
        ? {
            session: mutateSession(state.session, (draft) => {
              for (const workspace of draft.workspaces) {
                for (const tab of workspace.tabs) {
                  tab.tree = updatePane(tab.tree, paneId, { path })
                  tab.name = tabNameFor(tab, paneId, path)
                }
              }
            }),
          }
        : state,
    ),
}))
