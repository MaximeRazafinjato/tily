import { useRef } from 'react'
import type { ShellProfile } from '../bridge/messages'
import { isBrowserPane, isLeaf, SplitAxis, SplitSide, type SplitNode, type SplitPath } from '../model/session'
import { BrowserPaneView } from './BrowserPaneView'
import { PaneView } from './PaneView'
import { SplitResizer } from './SplitResizer'

type SplitResizeHandler = (path: SplitPath, ratio: number) => void

interface SplitViewProps {
  node: SplitNode
  path?: SplitPath
  zoomed?: boolean
  onToggleZoom: (paneId: string) => void
  activePaneId: string
  onFocus: (paneId: string) => void
  onClose: (paneId: string) => void
  onSplit: (paneId: string, axis: SplitAxis) => void
  onResize: SplitResizeHandler
  shells: ShellProfile[]
  onRestart: (paneId: string) => void
  onRestartIn: (paneId: string, path: string) => void
  onChangeShell: (paneId: string, shellId: string) => void
  onDismissState: (paneId: string) => void
}

const ROOT_PATH: SplitPath = []

export function SplitView({ node, path = ROOT_PATH, zoomed = false, onToggleZoom, activePaneId, onFocus, onClose, onSplit, onResize, shells, onRestart, onRestartIn, onChangeShell, onDismissState }: SplitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  if (isLeaf(node) && isBrowserPane(node.pane)) {
    return <BrowserPaneView pane={node.pane} active={node.pane.id === activePaneId} zoomed={zoomed} onToggleZoom={onToggleZoom} onFocus={onFocus} onClose={onClose} onSplit={onSplit} />
  }
  if (isLeaf(node)) {
    return <PaneView pane={node.pane} active={node.pane.id === activePaneId} zoomed={zoomed} onToggleZoom={onToggleZoom} onFocus={onFocus} onClose={onClose} onSplit={onSplit} shells={shells} onRestart={onRestart} onRestartIn={onRestartIn} onChangeShell={onChangeShell} onDismissState={onDismissState} />
  }
  const horizontal = node.axis === SplitAxis.Horizontal
  const handleResize = (ratio: number) => onResize(path, ratio)
  const child = (side: SplitSide, flex: number) => (
    <div className="min-h-0 min-w-0" style={{ flex, flexBasis: 0 }}>
      <SplitView node={node[side]} path={[...path, side]} onToggleZoom={onToggleZoom} activePaneId={activePaneId} onFocus={onFocus} onClose={onClose} onSplit={onSplit} onResize={onResize} shells={shells} onRestart={onRestart} onRestartIn={onRestartIn} onChangeShell={onChangeShell} onDismissState={onDismissState} />
    </div>
  )
  return (
    <div ref={containerRef} className={`flex h-full min-h-0 min-w-0 ${horizontal ? 'flex-row' : 'flex-col'}`}>
      {child(SplitSide.A, node.ratio)}
      <SplitResizer axis={node.axis} ratio={node.ratio} containerRef={containerRef} onResize={handleResize} />
      {child(SplitSide.B, 1 - node.ratio)}
    </div>
  )
}
