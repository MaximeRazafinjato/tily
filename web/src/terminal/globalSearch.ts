import type { IBuffer } from '@xterm/xterm'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { activeTab, activeWorkspace, folderName, panesOf, type Pane } from '../model/session'
import { firstMatch, searchPattern, type SearchOptions, type TextMatch } from '../model/textSearch'
import { useSessionStore } from '../store/sessionStore'
import { useTerminalSearchStore } from '../store/terminalSearchStore'
import { revealPaneMatch } from './paneSearch'
import { joinPane } from './terminalActions'
import { terminalRegistry } from './terminalRegistry'

export interface TerminalLine {
  id: string
  paneId: string
  row: number
  text: string
  location: string
}

export interface TerminalLineMatch extends TerminalLine {
  match: TextMatch
}

export interface TerminalLineResults {
  matches: TerminalLineMatch[]
  total: number
  panes: number
}

export interface MatchParts {
  before: string
  matched: string
  after: string
}

interface LocatedPane {
  pane: Pane
  location: string
}

const CONTEXT_BEFORE_MATCH = 40
const ELLIPSIS = '…'
const SEPARATOR = ' · '

const logicalLineAt = (buffer: IBuffer, row: number): string => {
  let text = ''
  for (let current = row; ; current++) {
    const continues = buffer.getLine(current + 1)?.isWrapped === true
    text += buffer.getLine(current)?.translateToString(!continues) ?? ''
    if (!continues) {
      return text
    }
  }
}

const linesOf = ({ pane, location }: LocatedPane): TerminalLine[] => {
  const buffer = terminalRegistry.get(pane.id)?.terminal.buffer.active
  if (!buffer) {
    return []
  }
  const lines: TerminalLine[] = []
  for (let row = buffer.length - 1; row >= 0; row--) {
    if (buffer.getLine(row)?.isWrapped === false) {
      const text = logicalLineAt(buffer, row)
      if (text.trim() !== '') {
        lines.push({ id: `${pane.id}:${row}`, paneId: pane.id, row, text, location })
      }
    }
  }
  return lines
}

export const collectTerminalLines = (): TerminalLine[] => {
  const { session } = useSessionStore.getState()
  if (!session) {
    return []
  }
  const workspace = activeWorkspace(session)
  const activePaneId = workspace ? activeTab(workspace).active : ''
  const located = session.workspaces.flatMap((candidate) =>
    candidate.tabs.flatMap((tab) => panesOf(tab.tree).map((pane) => ({ pane, location: `${candidate.name} / ${tab.name}${SEPARATOR}${folderName(pane.path)}` }))),
  )
  const activeFirst = [...located.filter(({ pane }) => pane.id === activePaneId), ...located.filter(({ pane }) => pane.id !== activePaneId)]
  return activeFirst.flatMap(linesOf)
}

export const findTerminalLines = (lines: TerminalLine[], query: string, options: SearchOptions, limit: number): TerminalLineResults => {
  const pattern = query === '' ? null : searchPattern(query, options)
  const results: TerminalLineResults = { matches: [], total: 0, panes: 0 }
  if (!pattern) {
    return results
  }
  const panes = new Set<string>()
  for (const line of lines) {
    const match = firstMatch(line.text, pattern)
    if (match) {
      results.total++
      panes.add(line.paneId)
      if (results.matches.length < limit) {
        results.matches.push({ ...line, match })
      }
    }
  }
  results.panes = panes.size
  return results
}

export const matchPartsOf = ({ text, match: { start, length } }: TerminalLineMatch): MatchParts => {
  const from = Math.max(0, start - CONTEXT_BEFORE_MATCH)
  return {
    before: `${from > 0 ? ELLIPSIS : ''}${text.slice(from, start).trimStart()}`,
    matched: text.slice(start, start + length),
    after: text.slice(start + length).trimEnd(),
  }
}

export const openGlobalSearch = (): void => useTerminalSearchStore.getState().setGlobalOpen(true)

export const closeGlobalSearch = (): void => {
  useTerminalSearchStore.getState().setGlobalOpen(false)
  focusActivePane()
}

export const goToTerminalLine = ({ paneId, row }: TerminalLine): void => {
  const { query, setGlobalOpen } = useTerminalSearchStore.getState()
  setGlobalOpen(false)
  joinPane(paneId)
  requestAnimationFrame(() => revealPaneMatch(paneId, row, query))
}
