import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Command, isCommandShortcut } from '../keyboard/shortcuts'
import { DEFAULT_GIT_GRAPH, GIT_REFERENCES_MAX, GIT_REFERENCES_MIN, RightPanelView, type GitGraphLayout } from '../model/session'
import { hideGitGraph, togglePanelView } from '../panel/rightPanel'
import { useGitStore } from '../store/gitStore'
import { useSessionStore } from '../store/sessionStore'
import { GitDragGhost } from './GitDragGhost'
import { GitGraphTable } from './GitGraphTable'
import { GitGraphToolbar } from './GitGraphToolbar'
import { GitRefsSidebar } from './GitRefsSidebar'
import { SidebarResizer } from './SidebarResizer'

interface GitGraphViewProps {
  layout: GitGraphLayout
}

const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
  if (isCommandShortcut(event.nativeEvent, Command.ToggleGit)) {
    togglePanelView(RightPanelView.Git, true)
  } else if (isCommandShortcut(event.nativeEvent, Command.ToggleExplorer)) {
    togglePanelView(RightPanelView.Files, true)
  } else if (event.key === 'Escape') {
    hideGitGraph()
  } else {
    return
  }
  event.preventDefault()
  event.stopPropagation()
}

const MIN_TABLE_WIDTH = 400

const handleResizeReferences = (referencesWidth: number) => useSessionStore.getState().setGitGraphLayout({ referencesWidth })

export function GitGraphView({ layout }: GitGraphViewProps) {
  const state = useGitStore((store) => store.state)
  const busy = useGitStore((store) => store.busy)
  const sectionRef = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(0)
  const [forced, setForced] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) {
      return
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(section)
    return () => observer.disconnect()
  }, [state])

  const cramped = width > 0 && width - layout.referencesWidth < MIN_TABLE_WIDTH
  const referencesShown = layout.referencesOpen && (!cramped || forced)
  const handleToggleReferences = () => {
    if (cramped && layout.referencesOpen) {
      setForced(!forced)
    } else {
      setForced(cramped)
      useSessionStore.getState().setGitGraphLayout({ referencesOpen: !layout.referencesOpen })
    }
  }

  if (!state) {
    return null
  }

  return (
    <section ref={sectionRef} aria-label="Graphe Git" data-git-graph="" className="absolute inset-0 z-10 flex flex-col bg-tily-panel" onKeyDown={handleKeyDown}>
      {busy && <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-[2px] animate-pulse bg-tily-green" />}
      <GitGraphToolbar state={state} referencesShown={referencesShown} onToggleReferences={handleToggleReferences} />
      <div className="flex min-h-0 flex-1">
        {referencesShown && (
          <>
            <GitRefsSidebar state={state} width={layout.referencesWidth} />
            <SidebarResizer width={layout.referencesWidth} min={GIT_REFERENCES_MIN} max={GIT_REFERENCES_MAX} defaultWidth={DEFAULT_GIT_GRAPH.referencesWidth} label="Largeur de la colonne des branches" onResize={handleResizeReferences} />
          </>
        )}
        <GitGraphTable state={state} layout={layout} />
      </div>
      <GitDragGhost />
    </section>
  )
}
