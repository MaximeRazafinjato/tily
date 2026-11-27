import type { KeyboardEvent } from 'react'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { NO_TYPED_TEXT, typeAheadIndex, typeAheadText } from '../keyboard/typeAhead'
import type { Session } from '../model/session'
import type { MoveTabHandler } from './tabDrag'

export interface WorkspacePanelActions {
  selectWorkspace: (workspaceId: string) => void
  toggleWorkspace: (workspaceId: string) => void
  startRenameWorkspace: (workspaceId: string) => void
  commitRenameWorkspace: (name: string) => void
  cancelRenameWorkspace: () => void
  closeWorkspace: (workspaceId: string) => void
  openNotes: (workspaceId: string) => void
  newTabIn: (workspaceId: string, shellId: string) => void
  newBrowserIn: (workspaceId: string) => void
  collapseOthers: (workspaceId: string) => void
  moveWorkspace: (workspaceId: string, offset: number) => void
  moveWorkspaceBefore: (workspaceId: string, beforeWorkspaceId?: string) => void
  shiftTab: (tabId: string, offset: number) => void
  duplicateTab: (tabId: string) => void
  selectTab: (workspaceId: string, tabId: string) => void
  startRenameTab: (tabId: string) => void
  commitRenameTab: (name: string) => void
  cancelRenameTab: () => void
  closeTab: (tabId: string) => void
  moveTab: MoveTabHandler
  joinPane: (paneId: string) => void
  newWorkspace: () => void
  openProjects: () => void
}

export interface PanelMenuRequest {
  workspaceId: string
  tabId?: string
  x: number
  y: number
  returnFocus: HTMLElement | null
}

export const PANEL_CLOSE_BUTTON =
  'flex size-[20px] shrink-0 cursor-pointer items-center justify-center rounded text-tily-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-tily-green-hover hover:text-tily-error'

export const PANEL_HOVER_BUTTON =
  'flex size-[20px] shrink-0 cursor-pointer items-center justify-center rounded text-tily-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-tily-green-hover hover:text-tily-ink aria-disabled:cursor-default aria-disabled:text-tily-muted/40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-tily-muted/40'

export const PANEL_NOTE_BUTTON =
  'flex size-[20px] shrink-0 cursor-pointer items-center justify-center rounded text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink'

export const PANEL_DROP_LINE =
  'pointer-events-none absolute -top-px right-0 left-0 h-[2px] rounded-full bg-tily-focus before:absolute before:-top-[2px] before:-left-[3px] before:size-[6px] before:rounded-full before:bg-tily-focus'

export interface MenuPlace {
  position: number
  count: number
}

export const MOVE_KEYS: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 }
export const EXPAND_KEY = 'ArrowRight'
export const COLLAPSE_KEY = 'ArrowLeft'

const PANEL_ROW_SELECTOR = '[data-panel-row]'
const ACTIVE_ROW_SELECTOR = `${PANEL_ROW_SELECTOR}[aria-current="true"]`
const WORKSPACE_LIST_SELECTOR = '[data-workspace-list]'
const SPACE_KEY = ' '
const WORKSPACE_SLOT_SELECTOR = '[data-workspace-slot]'
let panelTyped = NO_TYPED_TEXT

export const handlePanelRowKeys = (event: KeyboardEvent<HTMLElement>): void => {
  const target = event.target
  if (event.altKey || event.ctrlKey || event.metaKey || !(target instanceof HTMLElement) || !target.matches(PANEL_ROW_SELECTOR)) {
    return
  }
  const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(PANEL_ROW_SELECTOR))
  const index = rows.indexOf(target)
  const typed = typeAheadText(panelTyped, event)
  const destinations: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: rows.length - 1 }
  if (!event.shiftKey && event.key in destinations) {
    event.preventDefault()
    rows[destinations[event.key]]?.focus()
  } else if (!event.shiftKey && event.key === 'Escape') {
    event.preventDefault()
    focusActivePane()
  } else if (typed) {
    const found = typeAheadIndex(rows.map((row) => row.dataset.rowName ?? ''), index, typed.text)
    if (found < 0 && event.key === SPACE_KEY) {
      return
    }
    event.preventDefault()
    panelTyped = typed
    rows[found]?.focus()
  }
}

export const focusWorkspacePanel = (activeWorkspaceId: string | undefined): void => {
  const list = document.querySelector<HTMLElement>(WORKSPACE_LIST_SELECTOR)
  const activeSlot = activeWorkspaceId ? list?.querySelector<HTMLElement>(`${WORKSPACE_SLOT_SELECTOR}[data-workspace-slot="${activeWorkspaceId}"]`) : null
  const row = list?.querySelector<HTMLElement>(ACTIVE_ROW_SELECTOR) ?? activeSlot?.querySelector<HTMLElement>(PANEL_ROW_SELECTOR) ?? list?.querySelector<HTMLElement>(PANEL_ROW_SELECTOR)
  row?.focus()
}

export const focusOwnWorkspaceRow = (element: HTMLElement): void => element.closest(WORKSPACE_SLOT_SELECTOR)?.querySelector<HTMLElement>(PANEL_ROW_SELECTOR)?.focus()

export const menuPlaceOf = (session: Session, { workspaceId, tabId }: PanelMenuRequest): MenuPlace => {
  const tabs = session.workspaces.find((workspace) => workspace.id === workspaceId)?.tabs ?? []
  return tabId
    ? { position: tabs.findIndex((tab) => tab.id === tabId), count: tabs.length }
    : { position: session.workspaces.findIndex((workspace) => workspace.id === workspaceId), count: session.workspaces.length }
}

export const isMenuKey = (event: KeyboardEvent): boolean => (event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu'

export const menuRequestFor = (event: KeyboardEvent<HTMLElement>, workspaceId: string, tabId?: string): PanelMenuRequest => {
  const { left, bottom } = event.currentTarget.getBoundingClientRect()
  return { workspaceId, tabId, x: left, y: bottom, returnFocus: event.currentTarget }
}
