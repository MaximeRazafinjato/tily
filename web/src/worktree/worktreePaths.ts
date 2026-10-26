import { allPanes, findWorkspace, folderName, panesOf, type Pane, type Session } from '../model/session'
import { AgentState, type GitContext, type PaneAgent } from '../bridge/messages'
import type { WorktreeRemovalPane } from '../store/worktreeStore'

export interface WorktreeTarget {
  path: string
  name: string
  branch?: string
}

const SEPARATOR = '\\'
const LABEL_SEPARATOR = ' › '
const ACTIVE_AGENT_STATES = new Set([AgentState.Working, AgentState.Waiting, AgentState.Unknown])

const normalize = (path: string): string => path.replaceAll('/', SEPARATOR).replace(/\\+$/, '').toLowerCase()

export const isWithinFolder = (path: string, folder: string): boolean => {
  const candidate = normalize(path)
  const root = normalize(folder)
  return candidate === root || candidate.startsWith(`${root}${SEPARATOR}`)
}

export const sameFolder = (first: string, second: string): boolean => normalize(first) === normalize(second)

export const parentFolder = (path: string): string => {
  const trimmed = path.replace(/[\\/]+$/, '')
  return trimmed.slice(0, trimmed.length - folderName(trimmed).length).replace(/[\\/]+$/, '')
}

export const repositoryLabel = (repository: string, project: string): string => {
  if (sameFolder(repository, project)) {
    return folderName(repository)
  }
  return isWithinFolder(repository, project) ? repository.slice(project.replace(/[\\/]+$/, '').length + 1) : repository
}

export const worktreeTarget = (path: string): WorktreeTarget => ({ path, name: folderName(path) })

export const panesWithin = (session: Session, folder: string): Pane[] => allPanes(session).filter((pane) => isWithinFolder(pane.path, folder))

export const removalPanes = (session: Session, folder: string, agents: Record<string, PaneAgent>): WorktreeRemovalPane[] =>
  session.workspaces.flatMap((workspace) =>
    workspace.tabs.flatMap((tab) =>
      panesOf(tab.tree)
        .filter((pane) => isWithinFolder(pane.path, folder))
        .map((pane) => ({
          paneId: pane.id,
          label: [workspace.name, tab.name, folderName(pane.path)].join(LABEL_SEPARATOR),
          agent: agents[pane.id] !== undefined && ACTIVE_AGENT_STATES.has(agents[pane.id].state),
        })),
    ),
  )

export const worktreesOfPanes = (panes: Pane[], contexts: Record<string, GitContext>): WorktreeTarget[] => {
  const targets = new Map<string, WorktreeTarget>()
  for (const pane of panes) {
    const context = contexts[pane.id]
    const root = context?.worktreeRoot
    if (root && !targets.has(normalize(root))) {
      targets.set(normalize(root), { ...worktreeTarget(root), branch: context.branch ?? undefined })
    }
  }
  return [...targets.values()]
}

export const worktreesOfTabs = (session: Session, workspaceId: string, tabId: string | undefined, contexts: Record<string, GitContext>): WorktreeTarget[] => {
  const tabs = findWorkspace(session, workspaceId)?.tabs.filter((tab) => tabId === undefined || tab.id === tabId) ?? []
  return worktreesOfPanes(
    tabs.flatMap((tab) => panesOf(tab.tree)),
    contexts,
  )
}
