import { Command } from '../keyboard/commands'
import { shortcutTextIn, withShortcut } from '../keyboard/shortcutLabels'
import { RightPanelView } from '../model/session'
import { showPanelView } from '../panel/rightPanel'
import { FileExplorer } from './FileExplorer'
import { GitPanel } from './GitPanel'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { useShortcutStore } from '../store/shortcutStore'
import { PANEL_HEADER_BUTTON } from './rightPanelStyles'
import { WorkspaceNotes } from './WorkspaceNotes'

interface RightPanelProps {
  view: RightPanelView
  root: string
  width: number
  onClose: () => void
  onOpenTerminal: (path: string) => void
}

const VIEWS: { view: RightPanelView; label: string; command: Command }[] = [
  { view: RightPanelView.Files, label: 'Fichiers', command: Command.ToggleExplorer },
  { view: RightPanelView.Git, label: 'Git', command: Command.ToggleGit },
  { view: RightPanelView.Notes, label: 'Notes', command: Command.ToggleNotes },
]

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
  const shortcuts = useShortcutStore((state) => state.settings)
  return (
    <aside data-right-panel="" aria-label="Panneau de droite" className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-tily-paper" style={{ width }}>
      <div role="tablist" aria-label="Vue du panneau" className="flex h-[36px] shrink-0 items-center gap-[2px] pr-[6px] pl-[8px]">
        {VIEWS.map((entry) => {
          const selected = entry.view === view
          const handleSelect = () => showPanelView(entry.view)
          return (
            <button
              key={entry.view}
              type="button"
              role="tab"
              aria-selected={selected}
              data-tip={withShortcut(entry.label, shortcutTextIn(shortcuts, entry.command))}
              className={`cursor-pointer rounded-md px-[8px] py-[3px] text-[11px] font-semibold tracking-[0.06em] uppercase ${selected ? 'bg-tily-green-soft text-tily-green-deep' : 'text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink'}`}
              onClick={handleSelect}
            >
              {entry.label}
            </button>
          )
        })}
        <span className="flex-1" />
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Masquer le panneau" data-tip="Masquer le panneau" onClick={onClose}>
          <Icon name={IconName.Close} />
        </button>
      </div>
      {viewContent(view, root, onOpenTerminal)}
    </aside>
  )
}
