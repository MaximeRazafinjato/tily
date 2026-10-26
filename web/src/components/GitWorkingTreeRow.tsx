import type { MouseEvent } from 'react'
import type { GitGraphRow, GitState } from '../bridge/gitMessages'
import { OPERATION_LABELS, plural, workingTreeCounts } from '../git/gitLabels'
import type { GitGraphLayout } from '../model/session'
import { GitGraphCell } from './GitGraphCell'
import { GitNodeKind, GRAPH_ROW_HEIGHT, graphRowId, ROW_FOCUS_OUTLINE, WORKING_TREE_KEY } from './gitGraphStyles'

interface GitWorkingTreeRowProps {
  state: GitState
  graph: GitGraphRow
  selected: boolean
  layout: GitGraphLayout
  onSelect: () => void
  onMenu: (x: number, y: number) => void
}

export function GitWorkingTreeRow({ state, graph, selected, layout, onSelect, onMenu }: GitWorkingTreeRowProps) {
  const counts = workingTreeCounts(state)
  const clean = counts.modified + counts.added + counts.deleted + counts.conflicts === 0
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    onMenu(event.clientX, event.clientY)
  }
  const renderCount = (value: number, sign: string, tip: string, tone: string) =>
    value > 0 && (
      <span className={`shrink-0 font-mono text-[11.5px] ${tone}`} data-tip={tip}>
        {`${sign}${value}`}
      </span>
    )

  return (
    <div
      id={graphRowId(WORKING_TREE_KEY)}
      role="option"
      aria-selected={selected}
      className={`absolute inset-x-0 flex items-center text-[12px] select-none ${selected ? `bg-tily-green-soft ${ROW_FOCUS_OUTLINE}` : 'hover:bg-tily-green-hover'}`}
      style={{ top: 0, height: GRAPH_ROW_HEIGHT }}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
    >
      <span className="shrink-0" style={{ width: layout.labelsWidth }} />
      <GitGraphCell graph={graph} width={layout.graphWidth} node={GitNodeKind.WorkingTree} labelled={false} />
      <div className="flex min-w-0 flex-1 items-baseline gap-[10px] overflow-hidden pr-[8px] pl-[11px]">
        <span className="shrink-0 font-mono text-tily-muted italic" data-tip="Modifications de l’arbre de travail : stage et commit dans le panneau Git">
          {'// WIP'}
        </span>
        {state.operation && <span className="shrink-0 rounded bg-tily-warning/15 px-[6px] text-[11px] text-tily-warning">{`${OPERATION_LABELS[state.operation]} en cours`}</span>}
        {renderCount(counts.conflicts, '!', plural(counts.conflicts, 'fichier en conflit', 'fichiers en conflit'), 'text-tily-error')}
        {renderCount(counts.added, '+', plural(counts.added, 'fichier ajouté ou non suivi', 'fichiers ajoutés ou non suivis'), 'text-tily-green')}
        {renderCount(counts.modified, '~', plural(counts.modified, 'fichier modifié', 'fichiers modifiés'), 'text-tily-warning')}
        {renderCount(counts.deleted, '−', plural(counts.deleted, 'fichier supprimé', 'fichiers supprimés'), 'text-tily-error')}
        {clean && <span className="truncate text-[11px] text-tily-muted">Aucune modification</span>}
      </div>
    </div>
  )
}
