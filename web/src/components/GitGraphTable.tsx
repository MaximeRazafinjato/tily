import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { GitGraphRow as GitGraphRowModel, GitState } from '../bridge/gitMessages'
import { focusGitPanel, isInGitPanel, takeGraphFocusRequest } from '../git/gitFocus'
import { activateLabel, openColumnsMenu, openCommitMenu, openLabelMenu, openWorkingTreeMenu } from '../git/gitGraphActions'
import { loadMoreHistory, selectWorkingTree, showCommit } from '../git/gitRequests'
import type { GitGraphLayout } from '../model/session'
import { useGitStore } from '../store/gitStore'
import { useSessionStore } from '../store/sessionStore'
import { GitGraphHeader } from './GitGraphHeader'
import { GitGraphRow } from './GitGraphRow'
import { fitGraphColumns, GRAPH_HEADER_HEIGHT, GRAPH_ROW_HEIGHT, graphRowId, WORKING_TREE_KEY, type GitGraphRowHandlers } from './gitGraphStyles'
import { GitWorkingTreeRow } from './GitWorkingTreeRow'
import { useVirtualRows } from './useVirtualRows'
import { isMenuKey } from './workspacePanel'

interface GitGraphTableProps {
  state: GitState
  layout: GitGraphLayout
}

const KEYBOARD_DETAILS_DELAY_MS = 120
const SINGLE_NODE: GitGraphRowModel = { lane: 0, color: 0, width: 1, segments: [] }

const handlers: GitGraphRowHandlers = {
  select: (commit) => showCommit(commit.sha),
  openMenu: openCommitMenu,
  openLabelMenu,
  activateLabel,
}

const handleResize = (change: Partial<GitGraphLayout>) => useSessionStore.getState().setGitGraphLayout(change)

const scrollRowIntoView = (container: HTMLElement | null, index: number, center: boolean): void => {
  if (!container) {
    return
  }
  const top = index * GRAPH_ROW_HEIGHT
  if (center) {
    container.scrollTop = top - (container.clientHeight - GRAPH_HEADER_HEIGHT - GRAPH_ROW_HEIGHT) / 2
  } else if (top < container.scrollTop) {
    container.scrollTop = top
  } else if (GRAPH_HEADER_HEIGHT + top + GRAPH_ROW_HEIGHT > container.scrollTop + container.clientHeight) {
    container.scrollTop = GRAPH_HEADER_HEIGHT + top + GRAPH_ROW_HEIGHT - container.clientHeight
  }
}

export function GitGraphTable({ state, layout }: GitGraphTableProps) {
  const { history, historyError, commit, reveal } = useGitStore(useShallow((store) => ({ history: store.history, historyError: store.historyError, commit: store.commit, reveal: store.reveal })))
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const commits = useMemo(() => history?.commits ?? [], [history])
  const lanes = useMemo(() => commits.reduce((widest, entry) => Math.max(widest, entry.graph.width), history?.workingTree.width ?? SINGLE_NODE.width), [commits, history])
  const { authorShown, dateShown, labelsWidth, graphWidth } = fitGraphColumns(layout, width, lanes)
  const shownLayout = useMemo(() => ({ ...layout, authorShown, dateShown, labelsWidth, graphWidth }), [layout, authorShown, dateShown, labelsWidth, graphWidth])
  const hasMore = Boolean(history?.hasMore)
  const rowCount = 1 + commits.length + (hasMore ? 1 : 0)
  const { range, handleScroll } = useVirtualRows(containerRef, rowCount, GRAPH_ROW_HEIGHT)
  const commitIndex = commits.findIndex((entry) => entry.sha === commit)
  const activeIndex = commit === null ? 0 : commitIndex < 0 ? -1 : commitIndex + 1
  const firstCommit = Math.max(range.start, 1) - 1
  const lastCommit = Math.min(range.end, commits.length + 1) - 1

  useEffect(() => {
    if (takeGraphFocusRequest() && (document.activeElement === document.body || isInGitPanel(document.activeElement))) {
      containerRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (hasMore && range.end >= commits.length + 1) {
      loadMoreHistory()
    }
  }, [hasMore, range.end, commits.length])

  useEffect(() => {
    const index = reveal ? commits.findIndex((entry) => entry.sha === reveal) : -1
    if (index >= 0) {
      scrollRowIntoView(containerRef.current, index + 1, true)
      useGitStore.getState().requestReveal(null)
    }
  }, [reveal, commits])

  const moveTo = (index: number) => {
    const target = Math.min(Math.max(index, 0), commits.length)
    if (target === 0) {
      selectWorkingTree()
    } else {
      showCommit(commits[target - 1].sha, KEYBOARD_DETAILS_DELAY_MS)
    }
    scrollRowIntoView(containerRef.current, target, false)
  }
  const openMenuAtActive = () => {
    const key = activeIndex === 0 ? WORKING_TREE_KEY : commits[activeIndex - 1]?.sha
    const rect = key ? document.getElementById(graphRowId(key))?.getBoundingClientRect() : undefined
    const x = (rect?.left ?? 0) + shownLayout.labelsWidth + shownLayout.graphWidth
    const y = rect?.bottom ?? 0
    if (activeIndex === 0) {
      openWorkingTreeMenu(x, y)
    } else if (activeIndex > 0) {
      openCommitMenu(commits[activeIndex - 1], x, y)
    }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const start = Math.max(activeIndex, 0)
    const page = Math.max(1, Math.floor(((containerRef.current?.clientHeight ?? 0) - GRAPH_HEADER_HEIGHT) / GRAPH_ROW_HEIGHT) - 1)
    const moves: Record<string, number> = { ArrowDown: start + 1, ArrowUp: start - 1, PageDown: start + page, PageUp: start - page, Home: 0, End: commits.length }
    if (event.key in moves) {
      moveTo(moves[event.key])
    } else if (event.key === 'Enter') {
      focusGitPanel()
    } else if (isMenuKey(event)) {
      openMenuAtActive()
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }
  const activeKey = activeIndex === 0 ? WORKING_TREE_KEY : commits[activeIndex - 1]?.sha

  return (
    <div
      ref={containerRef}
      role="listbox"
      tabIndex={0}
      aria-label="Graphe des commits : ↑ / ↓ pour choisir, Entrée pour aller au détail, Maj+F10 pour les actions"
      aria-activedescendant={activeKey ? graphRowId(activeKey) : undefined}
      data-git-graph-list=""
      className="group relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto focus:outline-none"
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
    >
      <GitGraphHeader layout={shownLayout} stored={layout} onResize={handleResize} onMenu={openColumnsMenu} />
      {historyError && <p className="px-[12px] py-[4px] text-[12px] text-tily-error">{historyError}</p>}
      <div className="relative" style={{ height: rowCount * GRAPH_ROW_HEIGHT }}>
        {range.start === 0 && <GitWorkingTreeRow state={state} graph={history?.workingTree ?? SINGLE_NODE} selected={commit === null} layout={shownLayout} onSelect={selectWorkingTree} onMenu={openWorkingTreeMenu} />}
        {commits.slice(firstCommit, lastCommit).map((entry, offset) => (
          <GitGraphRow key={entry.sha} commit={entry} index={firstCommit + offset + 1} selected={entry.sha === commit} head={entry.sha === state.head.sha} layout={shownLayout} remotes={state.remotes} handlers={handlers} />
        ))}
        {hasMore && range.end >= commits.length + 1 && (
          <div className="absolute inset-x-0 flex items-center px-[12px] text-[11px] text-tily-muted italic" style={{ top: (commits.length + 1) * GRAPH_ROW_HEIGHT, height: GRAPH_ROW_HEIGHT }}>
            Chargement des commits suivants…
          </div>
        )}
        {history && commits.length === 0 && !historyError && (
          <p className="absolute inset-x-0 px-[12px] text-[12px] text-tily-muted italic" style={{ top: GRAPH_ROW_HEIGHT + 6 }}>
            Aucun commit pour l’instant.
          </p>
        )}
      </div>
    </div>
  )
}
