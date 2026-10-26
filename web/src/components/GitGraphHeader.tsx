import type { MouseEvent } from 'react'
import { DEFAULT_GIT_GRAPH, type GitGraphLayout } from '../model/session'
import { GitColumnResizer } from './GitColumnResizer'
import { GRAPH_HEADER_HEIGHT, ResizerSide } from './gitGraphStyles'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { ROW_ACTION } from './rightPanelStyles'

interface GitGraphHeaderProps {
  layout: GitGraphLayout
  stored: Pick<GitGraphLayout, 'labelsWidth' | 'graphWidth'>
  onResize: (change: Partial<GitGraphLayout>) => void
  onMenu: (x: number, y: number) => void
}

const CELL = 'relative flex h-full shrink-0 items-center'

export function GitGraphHeader({ layout, stored, onResize, onMenu }: GitGraphHeaderProps) {
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onMenu(event.clientX, event.clientY)
  }
  const handleMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    onMenu(rect.left, rect.bottom)
  }
  const handleLabels = (labelsWidth: number) => onResize({ labelsWidth })
  const handleGraph = (graphWidth: number) => onResize({ graphWidth })
  const handleAuthor = (authorWidth: number) => onResize({ authorWidth })
  const handleDate = (dateWidth: number) => onResize({ dateWidth })

  return (
    <div
      role="row"
      className="sticky top-0 z-10 flex shrink-0 items-center border-b border-tily-line bg-tily-panel text-[11px] font-semibold tracking-[0.06em] text-tily-muted uppercase select-none"
      style={{ height: GRAPH_HEADER_HEIGHT }}
      onContextMenu={handleContextMenu}
    >
      <span role="columnheader" className={`${CELL} pl-[10px]`} style={{ width: layout.labelsWidth }}>
        <span className="truncate">Branche / Tag</span>
        <GitColumnResizer side={ResizerSide.Right} width={layout.labelsWidth} defaultWidth={DEFAULT_GIT_GRAPH.labelsWidth} label="Largeur de la colonne Branche / Tag" narrowed={layout.labelsWidth < stored.labelsWidth} onResize={handleLabels} />
      </span>
      <span role="columnheader" className={`${CELL} pl-[6px]`} style={{ width: layout.graphWidth }}>
        <span className="truncate">Graphe</span>
        <GitColumnResizer side={ResizerSide.Right} width={layout.graphWidth} defaultWidth={DEFAULT_GIT_GRAPH.graphWidth} label="Largeur de la colonne Graphe" narrowed={layout.graphWidth < stored.graphWidth} onResize={handleGraph} />
      </span>
      <span role="columnheader" className="min-w-0 flex-1 truncate pl-[11px]">
        Message
      </span>
      {layout.authorShown && (
        <span role="columnheader" className={`${CELL} px-[8px]`} style={{ width: layout.authorWidth }}>
          <GitColumnResizer side={ResizerSide.Left} width={layout.authorWidth} defaultWidth={DEFAULT_GIT_GRAPH.authorWidth} label="Largeur de la colonne Auteur" narrowed={false} onResize={handleAuthor} />
          <span className="truncate">Auteur</span>
        </span>
      )}
      {layout.dateShown && (
        <span role="columnheader" className={`${CELL} px-[8px]`} style={{ width: layout.dateWidth }}>
          <GitColumnResizer side={ResizerSide.Left} width={layout.dateWidth} defaultWidth={DEFAULT_GIT_GRAPH.dateWidth} label="Largeur de la colonne Date" narrowed={false} onResize={handleDate} />
          <span className="truncate">Date</span>
        </span>
      )}
      <button type="button" className={`${ROW_ACTION} absolute right-[4px]`} aria-label="Colonnes affichées" data-tip="Colonnes affichées" onClick={handleMenuClick}>
        <Icon name={IconName.Columns} />
      </button>
    </div>
  )
}
