import { memo, useCallback, useEffect, useState, type MouseEvent } from 'react'
import { OpenTarget, type ShellProfile } from '../bridge/messages'
import { DEFAULT_SHELL, RightPanelView, SplitAxis, type Pane } from '../model/session'
import { openPanelView } from '../panel/rightPanel'
import { useAgentStore } from '../store/agentStore'
import { useHostStore } from '../store/hostStore'
import { usePaneStore } from '../store/paneStore'
import { useTerminalSearchStore } from '../store/terminalSearchStore'
import { copyPaneBranch, copyPanePath, gitSummary, openPaneFolder, queryContext } from '../terminal/contextActions'
import { clearPaneScrollback, copyLastCommandOutput, copyPaneSelection, focusPane, hasPaneSelection, pasteIntoPane, selectAllInPane, setPaneTerminalTabbable } from '../terminal/terminalActions'
import { movePaneToNewTab } from '../terminal/tabLifecycle'
import { TerminalPane } from '../terminal/TerminalPane'
import { AgentBadge } from './AgentBadge'
import { BranchEditMergeRequestButton } from './BranchEditMergeRequestButton'
import { CreateMergeRequestButton } from './CreateMergeRequestButton'
import { MergeRequestPill } from './MergeRequestPill'
import { AgentOwnerMark } from './AgentOwnerMark'
import { PaneOverlay } from './PaneOverlay'
import { PaneSearchBar } from './PaneSearchBar'
import { TerminalContextMenu, type TerminalMenuActions, type TerminalMenuRequest } from './TerminalContextMenu'
import { Command } from '../keyboard/commands'
import { useShortcutText, withShortcut } from '../keyboard/shortcutLabels'
import { usePaneHeaderTips } from './paneHeaderTips'

interface PaneViewProps {
  pane: Pane
  active: boolean
  zoomed: boolean
  onToggleZoom: (paneId: string) => void
  onFocus: (paneId: string) => void
  onClose: (paneId: string) => void
  onSplit: (paneId: string, axis: SplitAxis) => void
  shells: ShellProfile[]
  onRestart: (paneId: string) => void
  onRestartIn: (paneId: string, path: string) => void
  onChangeShell: (paneId: string, shellId: string) => void
  onDismissState: (paneId: string) => void
}

const HEADER_BUTTON = 'flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-tily-green-hover hover:text-tily-ink'
const BUTTON_SELECTOR = 'button'
const SINGLE_CLICK = 1
const SECONDARY_BUTTON = `${HEADER_BUTTON} @max-[280px]:hidden`
const MUTED_BUTTON = 'opacity-40 hover:bg-transparent hover:text-tily-muted'
const ICON_SIZE = 12
const ICON_PROPS = { width: ICON_SIZE, height: ICON_SIZE, viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const CopyIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
    <path d="M8 4V2.5A1 1 0 0 0 7 1.5H2.5a1 1 0 0 0-1 1V7a1 1 0 0 0 1 1H4" />
  </svg>
)

const EditorIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <path d="M4 3 1.5 6 4 9" />
    <path d="M8 3l2.5 3L8 9" />
  </svg>
)

const FolderIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <path d="M1.5 2.75h3l1 1h5v5.5h-9z" />
  </svg>
)

const DETACHED_LABEL = 'HEAD détachée'
const LAST_FOLDER = /([^\\/]+)[\\/]*$/

const lastFolder = (path: string): string => LAST_FOLDER.exec(path)?.[1] ?? path

const BranchIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <circle cx="3" cy="2.5" r="1.2" />
    <circle cx="3" cy="9.5" r="1.2" />
    <circle cx="9" cy="4" r="1.2" />
    <path d="M3 3.7v4.6M9 5.2c0 2-6 1.5-6 3.5" />
  </svg>
)

const SplitIcon = ({ horizontal }: { horizontal: boolean }) => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
    {horizontal ? <line x1="6" y1="1.5" x2="6" y2="10.5" /> : <line x1="1.5" y1="6" x2="10.5" y2="6" />}
  </svg>
)

const UnzoomIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <path d="M4.5 1.5v3h-3M7.5 1.5v3h3M4.5 10.5v-3h-3M7.5 10.5v-3h3" />
  </svg>
)

const CloseIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <line x1="3" y1="3" x2="9" y2="9" />
    <line x1="9" y1="3" x2="3" y2="9" />
  </svg>
)

export const PaneView = memo(function PaneView({ pane, active, zoomed, onToggleZoom, onFocus, onClose, onSplit, shells, onRestart, onRestartIn, onChangeShell, onDismissState }: PaneViewProps) {
  const paneState = usePaneStore((state) => state.states[pane.id])
  const context = useHostStore((state) => state.contexts[pane.id])
  const agent = useAgentStore((state) => state.agents[pane.id])
  const searching = useTerminalSearchStore((state) => state.paneId === pane.id)
  const [menu, setMenu] = useState<TerminalMenuRequest | null>(null)
  const tips = usePaneHeaderTips()
  const gitShortcut = useShortcutText(Command.ToggleGit)

  useEffect(() => {
    queryContext(pane.id)
  }, [pane.id, pane.path])

  const covered = paneState !== undefined
  useEffect(() => {
    setPaneTerminalTabbable(pane.id, !covered)
  }, [pane.id, covered])

  const handleHeaderMouseDown = () => onFocus(pane.id)
  const handleOpenGit = () => openPanelView(RightPanelView.Git)
  const handleHeaderDoubleClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element && event.target.closest(BUTTON_SELECTOR))) {
      onToggleZoom(pane.id)
    }
  }
  const handleToggleZoom = () => onToggleZoom(pane.id)
  const handleFocusWithin = () => {
    if (!active) {
      onFocus(pane.id)
    }
  }
  const handleRestart = () => onRestart(pane.id)
  const handleRestartIn = (path: string) => onRestartIn(pane.id, path)
  const handleDismissState = () => onDismissState(pane.id)
  const handleChangeShell = (shellId: string) => onChangeShell(pane.id, shellId)
  const handleCopyPath = () => copyPanePath(pane.id)
  const handleOpenEditor = () => openPaneFolder(pane.id, OpenTarget.Editor)
  const handleOpenExplorer = () => openPaneFolder(pane.id, OpenTarget.Explorer)
  const handleCopyBranch = () => copyPaneBranch(pane.id)
  const handleSplitSideBySide = () => onSplit(pane.id, SplitAxis.Horizontal)
  const handleSplitTopBottom = () => onSplit(pane.id, SplitAxis.Vertical)
  const handleClose = () => onClose(pane.id)
  const ignoringRepeatedClicks = (action: () => void) => (event: MouseEvent) => {
    if (event.detail <= SINGLE_CLICK) {
      action()
    }
  }
  const handleContextMenu = (x: number, y: number) => setMenu({ x, y })
  const handleDismissMenu = useCallback(() => {
    setMenu(null)
    focusPane(pane.id)
  }, [pane.id])
  const menuActions: TerminalMenuActions = {
    copy: () => copyPaneSelection(pane.id),
    copyLastOutput: () => copyLastCommandOutput(pane.id),
    paste: () => pasteIntoPane(pane.id),
    selectAll: () => selectAllInPane(pane.id),
    clearScrollback: () => clearPaneScrollback(pane.id),
    splitSideBySide: handleSplitSideBySide,
    splitTopBottom: handleSplitTopBottom,
    toggleZoom: handleToggleZoom,
    moveToNewTab: () => movePaneToNewTab(pane.id),
    close: handleClose,
  }
  const branchTitle = context?.branch ? `Copier la branche « ${context.branch} »` : gitSummary(context)
  const branchLabel = context?.branch ?? (context?.detachedHead ? DETACHED_LABEL : null)

  return (
    <section
      data-pane-id={pane.id}
      className={`grid h-full min-h-0 grid-cols-1 grid-rows-[24px_1fr] overflow-hidden rounded-md border bg-tily-terminal ${active ? 'border-tily-green' : 'border-tily-line'}`}
      onFocus={handleFocusWithin}
    >
      <header
        className="@container flex items-center gap-1 bg-tily-panel px-2 text-[11px] text-tily-muted select-none"
        onMouseDown={handleHeaderMouseDown}
        onDoubleClick={handleHeaderDoubleClick}
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-1">
          {pane.shell !== DEFAULT_SHELL && <span className="mr-1 min-w-[2em] truncate font-semibold text-tily-ink">{pane.shell}</span>}
          {agent && (
            <span className="flex min-w-0 self-center">
              <AgentBadge agent={agent} />
            </span>
          )}
          {pane.owner && (
            <span className="flex min-w-0 self-center">
              <AgentOwnerMark owner={pane.owner} />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate font-mono whitespace-nowrap text-tily-green" data-tip={pane.path}>
            {lastFolder(pane.path)}
          </span>
        </span>
        {branchLabel && (
          <button
            type="button"
            className="flex max-w-[35%] min-w-0 shrink cursor-pointer items-center gap-1 rounded font-mono text-tily-muted hover:text-tily-ink @max-[520px]:hidden"
            data-tip={withShortcut(`${gitSummary(context)} · Vue Git`, gitShortcut)}
            aria-label={`${branchLabel} : ouvrir la vue Git`}
            onClick={handleOpenGit}
          >
            <BranchIcon />
            <span className="truncate py-1 [text-box:trim-both_cap_alphabetic]">{branchLabel}</span>
          </button>
        )}
        {context?.branch && <MergeRequestPill path={pane.path} branch={context.branch} className="@max-[520px]:hidden" />}
        {context?.branch && <BranchEditMergeRequestButton path={pane.path} branch={context.branch} className="@max-[520px]:hidden" />}
        {context?.branch && <CreateMergeRequestButton path={pane.path} branch={context.branch} className="@max-[520px]:hidden" />}
        <button type="button" className={SECONDARY_BUTTON} data-tip={`Copier le chemin ${pane.path}`} aria-label="Copier le chemin" onClick={handleCopyPath}>
          <CopyIcon />
        </button>
        <button type="button" className={SECONDARY_BUTTON} data-tip="Ouvrir dans l’éditeur" aria-label="Ouvrir dans l’éditeur" onClick={handleOpenEditor}>
          <EditorIcon />
        </button>
        <button type="button" className={SECONDARY_BUTTON} data-tip="Ouvrir dans l’explorateur" aria-label="Ouvrir dans l’explorateur" onClick={handleOpenExplorer}>
          <FolderIcon />
        </button>
        <button type="button" className={`${SECONDARY_BUTTON} ${context?.branch ? '' : MUTED_BUTTON}`} data-tip={branchTitle} aria-label="Copier la branche Git" aria-disabled={!context?.branch} onClick={handleCopyBranch}>
          <BranchIcon />
        </button>
        <span className="mx-1 h-3 w-px bg-tily-line @max-[280px]:hidden" aria-hidden="true" />
        <button type="button" className={HEADER_BUTTON} data-tip={tips.splitSideBySide} aria-label="Split côte à côte" onClick={ignoringRepeatedClicks(handleSplitSideBySide)}>
          <SplitIcon horizontal />
        </button>
        <button type="button" className={HEADER_BUTTON} data-tip={tips.splitTopBottom} aria-label="Split haut / bas" onClick={ignoringRepeatedClicks(handleSplitTopBottom)}>
          <SplitIcon horizontal={false} />
        </button>
        {zoomed && (
          <button type="button" className={`${HEADER_BUTTON} text-tily-green`} data-tip={tips.reduce} aria-label="Réduire le pane" onClick={handleToggleZoom}>
            <UnzoomIcon />
          </button>
        )}
        <button type="button" className={`${HEADER_BUTTON} hover:text-tily-error`} data-tip={tips.close} aria-label="Fermer le pane" onClick={ignoringRepeatedClicks(handleClose)}>
          <CloseIcon />
        </button>
      </header>
      <div className="relative min-h-0">
        <TerminalPane pane={pane} active={active} onFocus={onFocus} onContextMenu={handleContextMenu} />
        {searching && !paneState && <PaneSearchBar />}
        {paneState && <PaneOverlay state={paneState} active={active} shells={shells} onRestart={handleRestart} onRestartIn={handleRestartIn} onChangeShell={handleChangeShell} onDismiss={handleDismissState} onClose={handleClose} />}
      </div>
      {menu && <TerminalContextMenu request={menu} canCopy={hasPaneSelection(pane.id)} zoomed={zoomed} actions={menuActions} onDismiss={handleDismissMenu} />}
    </section>
  )
})
