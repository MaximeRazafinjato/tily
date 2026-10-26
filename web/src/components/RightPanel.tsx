import { RightPanelView } from '../model/session'
import { FileExplorer } from './FileExplorer'
import { GitPanel } from './GitPanel'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { PANEL_HEADER_BUTTON, SECTION_TITLE } from './rightPanelStyles'
import { WorkspaceNotes } from './WorkspaceNotes'

interface RightPanelProps {
  view: RightPanelView
  root: string
  width: number
  onClose: () => void
  onOpenTerminal: (path: string) => void
}

const VIEW_LABELS: Record<RightPanelView, string> = {
  [RightPanelView.Files]: 'Fichiers',
  [RightPanelView.Git]: 'Git',
  [RightPanelView.Notes]: 'Notes',
}

const viewContent = (view: RightPanelView, root: string, onOpenTerminal: (path: string) => void) => {
  if (view === RightPanelView.Git) {
    return <GitPanel folder={root} />
  }
  if (view === RightPanelView.Notes) {
    return <WorkspaceNotes />
  }
  return <FileExplorer root={root} onOpenTerminal={onOpenTerminal} />
}

export function RightPanel({ view, root, width, onClose, onOpenTerminal }: RightPanelProps) {
  return (
    <aside data-right-panel="" aria-label="Panneau de droite" className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-tily-paper" style={{ width }}>
      <div className="flex h-[36px] shrink-0 items-center gap-[2px] pr-[6px] pl-[12px]">
        <h2 className={`flex-1 ${SECTION_TITLE}`}>{VIEW_LABELS[view]}</h2>
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Masquer le panneau" data-tip="Masquer le panneau" onClick={onClose}>
          <Icon name={IconName.Close} />
        </button>
      </div>
      {viewContent(view, root, onOpenTerminal)}
    </aside>
  )
}
