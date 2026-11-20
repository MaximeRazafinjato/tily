import type { TransferPayload } from '../bridge/windowMessages'
import { findWorkspace, mergedNote, type Session, type Workspace } from '../model/session'
import type { WindowWorkspace } from '../bridge/windowMessages'

export const takeTab = (draft: Session, tabId: string): void => {
  const workspace = draft.workspaces.find((candidate) => candidate.tabs.some((tab) => tab.id === tabId))
  if (!workspace) {
    return
  }
  const index = workspace.tabs.findIndex((tab) => tab.id === tabId)
  workspace.tabs.splice(index, 1)
  if (workspace.tabs.length === 0) {
    takeWorkspace(draft, workspace.id)
  } else if (workspace.active === tabId) {
    workspace.active = workspace.tabs[Math.min(index, workspace.tabs.length - 1)].id
  }
}

export const takeWorkspace = (draft: Session, workspaceId: string): void => {
  const index = draft.workspaces.findIndex((workspace) => workspace.id === workspaceId)
  if (index < 0) {
    return
  }
  draft.workspaces.splice(index, 1)
  if (draft.active === workspaceId) {
    draft.active = draft.workspaces[Math.min(index, draft.workspaces.length - 1)]?.id ?? ''
  }
}

const withoutLink = ({ linkedNote: _linkedNote, ...workspace }: Workspace): Workspace => workspace

const mergeNoteInto = (existing: Workspace, incoming: Workspace): void => {
  if (!incoming.note || incoming.linkedNote) {
    return
  }
  if (existing.linkedNote) {
    existing.note = incoming.note
    delete existing.linkedNote
    return
  }
  existing.note = mergedNote(existing.note, incoming.name, incoming.note)
}

export const syncLinkedNotes = (draft: Session, mainWorkspaces: WindowWorkspace[]): void => {
  for (const workspace of draft.workspaces) {
    const origin = workspace.linkedNote ? mainWorkspaces.find((candidate) => candidate.id === workspace.id) : undefined
    if (origin && workspace.note !== origin.note) {
      workspace.note = origin.note
    }
  }
}

export const insertTransfer = (draft: Session, payload: TransferPayload, detachedWindow: boolean): void => {
  if (detachedWindow && draft.workspaces.length === 0) {
    const { sidebar, sidebarCollapsed, explorerWidth, gitGraph, favorites } = payload.layout
    Object.assign(draft, { sidebar, sidebarCollapsed, explorerWidth, gitGraph, favorites })
  }
  for (const workspace of payload.workspaces) {
    const existing = findWorkspace(draft, workspace.id)
    if (!existing) {
      draft.workspaces.push(detachedWindow ? workspace : withoutLink(workspace))
      continue
    }
    existing.tabs.push(...workspace.tabs)
    existing.active = workspace.active
    existing.expanded = true
    mergeNoteInto(existing, workspace)
  }
  const first = payload.workspaces[0]
  if (first) {
    draft.active = first.id
  }
}
