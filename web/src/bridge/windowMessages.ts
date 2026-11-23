import type { GitGraphLayout, PaneEdge, Workspace } from '../model/session'

export interface WindowWorkspace {
  id: string
  name: string
  note?: string
}

export interface WindowInfo {
  detached: boolean
  id: string
  mainWorkspaces?: WindowWorkspace[] | null
}

export interface TransferredTerminal {
  pane: string
  text: string
  cols: number
  rows: number
  started: boolean
}

export interface TransferLayout {
  sidebar: number
  sidebarCollapsed: boolean
  explorerWidth: number
  gitGraph: GitGraphLayout
  favorites: string[]
}

export interface TransferPayload {
  workspaces: Workspace[]
  terminals: TransferredTerminal[]
  layout: TransferLayout
}

export enum TransferDropKind {
  Tab = 'tab',
  Pane = 'pane',
  Workspace = 'workspace',
}

export interface TransferDrop {
  kind: TransferDropKind
  workspaceId?: string
  beforeTabId?: string
  paneId?: string
  edge?: PaneEdge
  beforeWorkspaceId?: string
}

export type WindowHostMessage =
  | { type: 'window.receive'; payload: TransferPayload; x?: number | null; y?: number | null; drop?: TransferDrop | null }
  | { type: 'window.transferred'; request: number; done: boolean }
  | { type: 'terminal.held'; request: number }
  | { type: 'window.detached'; tabs: string[] }
  | { type: 'window.mainWorkspaces'; workspaces: WindowWorkspace[] }
  | { type: 'window.showNote'; workspace: string }
  | { type: 'window.dragOver'; x: number; y: number; single: boolean }
  | { type: 'window.dragLeave' }

export type WindowWebMessage =
  | { type: 'window.transfer'; request: number; payload: TransferPayload; panes: string[]; atCursor: boolean; window?: string; drop?: TransferDrop }
  | { type: 'terminal.hold'; request: number; panes: string[] }
  | { type: 'terminal.adopted'; panes: string[] }
  | { type: 'window.summary'; tabs: string[] }
  | { type: 'window.workspaces'; workspaces: WindowWorkspace[] }
  | { type: 'window.showMainNote'; workspace: string }
  | { type: 'window.dragMove'; name: string; single: boolean }
  | { type: 'window.dragEnd' }
