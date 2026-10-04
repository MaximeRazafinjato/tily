import { memo, useEffect, useRef, type MouseEvent } from 'react'
import { goBack, navigateBrowser, openDevTools, reloadBrowser, setBrowserViewport } from '../browser/browserActions'
import { focusBrowser, snapshotShown } from '../browser/browserLayer'
import { BrowserViewport } from '../model/browser'
import { SplitAxis, type Pane } from '../model/session'
import { useBrowserStore } from '../store/browserStore'
import { useUiStore } from '../store/uiStore'
import { AgentOwnerMark } from './AgentOwnerMark'
import { BrowserAddressBar } from './BrowserAddressBar'

interface BrowserPaneViewProps {
  pane: Pane
  active: boolean
  zoomed: boolean
  onToggleZoom: (paneId: string) => void
  onFocus: (paneId: string) => void
  onClose: (paneId: string) => void
  onSplit: (paneId: string, axis: SplitAxis) => void
}

const HEADER_BUTTON = 'flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-tily-green-hover hover:text-tily-ink disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent'
const SECONDARY_BUTTON = `${HEADER_BUTTON} @max-[280px]:hidden`
const BUTTON_SELECTOR = 'button, input'
const SINGLE_CLICK = 1
const ICON_SIZE = 12
const ICON_PROPS = { width: ICON_SIZE, height: ICON_SIZE, viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const GlobeIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <circle cx="6" cy="6" r="4.5" />
    <path d="M1.5 6h9M6 1.5c1.4 1.3 2 2.8 2 4.5s-.6 3.2-2 4.5C4.6 9.2 4 7.7 4 6s.6-3.2 2-4.5z" />
  </svg>
)

const BackIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <path d="M7.5 2.5 4 6l3.5 3.5" />
  </svg>
)

const ReloadIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <path d="M9.8 5A4 4 0 1 0 10 7" />
    <path d="M10 2v3H7" />
  </svg>
)

const MobileIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <rect x="3.5" y="1.5" width="5" height="9" rx="1" />
    <path d="M5.5 9h1" />
  </svg>
)

const DesktopIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <rect x="1.5" y="2" width="9" height="6" rx="1" />
    <path d="M4.5 10h3M6 8v2" />
  </svg>
)

const DevToolsIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <path d="M4 3 1.5 6 4 9M8 3l2.5 3L8 9M6.8 2.5l-1.6 7" />
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

const ErrorIcon = () => (
  <svg {...ICON_PROPS} aria-hidden="true">
    <circle cx="6" cy="6" r="4.5" />
    <path d="M6 3.5v3M6 8.5v.01" />
  </svg>
)

const errorsLabel = (count: number): string => (count === 1 ? '1 erreur' : `${count} erreurs`)

const focusBlocked = (): boolean => {
  const { renamingWorkspaceId, renamingTabId, paletteOpen, projectPickerOpen, settingsOpen, closeConfirmation } = useUiStore.getState()
  return Boolean(renamingWorkspaceId || renamingTabId || paletteOpen || projectPickerOpen || settingsOpen || closeConfirmation)
}

export const BrowserPaneView = memo(function BrowserPaneView({ pane, active, zoomed, onToggleZoom, onFocus, onClose, onSplit }: BrowserPaneViewProps) {
  const state = useBrowserStore((store) => store.states[pane.id])
  const snapshot = useBrowserStore((store) => store.snapshots[pane.id])
  const failure = useBrowserStore((store) => store.failures[pane.id])
  const editing = useBrowserStore((store) => store.editingUrl === pane.id)
  const sectionRef = useRef<HTMLElement>(null)
  const mobile = (state?.viewport ?? pane.viewport) === BrowserViewport.Mobile

  useEffect(() => {
    const focusInPane = Boolean(sectionRef.current?.contains(document.activeElement))
    if (active && !editing && !focusInPane && !focusBlocked()) {
      focusBrowser(pane.id)
    }
  }, [active, editing, pane.id])

  const handleHeaderMouseDown = () => onFocus(pane.id)
  const handleHeaderDoubleClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element && event.target.closest(BUTTON_SELECTOR))) {
      onToggleZoom(pane.id)
    }
  }
  const handleNavigate = (address: string) => navigateBrowser(pane.id, address)
  const handleLeaveAddress = (returnToPage: boolean) => {
    useBrowserStore.getState().editUrl(null)
    if (returnToPage) {
      focusBrowser(pane.id)
    }
  }
  const handleBack = () => goBack(pane.id)
  const handleReload = () => reloadBrowser(pane.id)
  const handleToggleViewport = () => setBrowserViewport(pane.id, mobile ? BrowserViewport.Desktop : BrowserViewport.Mobile)
  const handleDevTools = () => openDevTools(pane.id)
  const handleBodyMouseDown = () => onFocus(pane.id)
  const handleSnapshotLoad = () => snapshotShown(pane.id)
  const handleSplitSideBySide = () => onSplit(pane.id, SplitAxis.Horizontal)
  const handleSplitTopBottom = () => onSplit(pane.id, SplitAxis.Vertical)
  const handleToggleZoom = () => onToggleZoom(pane.id)
  const handleClose = () => onClose(pane.id)
  const ignoringRepeatedClicks = (action: () => void) => (event: MouseEvent) => {
    if (event.detail <= SINGLE_CLICK) {
      action()
    }
  }
  const viewportLabel = mobile ? 'Largeur desktop' : 'Largeur mobile (390 px)'
  const errors = state?.errors ?? 0

  return (
    <section
      ref={sectionRef}
      data-pane-id={pane.id}
      className={`grid h-full min-h-0 grid-cols-1 grid-rows-[24px_1fr] overflow-hidden rounded-md border bg-tily-terminal ${active ? 'border-tily-green' : 'border-tily-line'}`}
    >
      <header className="@container flex items-center gap-1 bg-tily-panel px-2 text-[11px] text-tily-muted select-none" onMouseDown={handleHeaderMouseDown} onDoubleClick={handleHeaderDoubleClick}>
        <span className="shrink-0 text-tily-ink" aria-hidden="true">
          <GlobeIcon />
        </span>
        {pane.owner && <AgentOwnerMark owner={pane.owner} />}
        <button type="button" className={HEADER_BUTTON} data-tip="Précédent" aria-label="Précédent" disabled={!state?.canGoBack} onClick={handleBack}>
          <BackIcon />
        </button>
        <button type="button" className={`${HEADER_BUTTON} ${state?.loading ? 'animate-spin' : ''}`} data-tip="Recharger" aria-label="Recharger" onClick={handleReload}>
          <ReloadIcon />
        </button>
        <BrowserAddressBar url={state?.url ?? pane.url} editing={editing} onNavigate={handleNavigate} onLeave={handleLeaveAddress} />
        {errors > 0 && (
          <button type="button" className="flex h-5 shrink-0 cursor-pointer items-center gap-1 rounded px-1 font-mono text-tily-error hover:bg-tily-green-hover" data-tip={`${errorsLabel(errors)} depuis le dernier chargement (console et réseau) · clic : outils de développement`} aria-label={errorsLabel(errors)} onClick={handleDevTools}>
            <ErrorIcon />
            {errors}
          </button>
        )}
        <button type="button" className={`${SECONDARY_BUTTON} ${mobile ? 'text-tily-green' : ''}`} data-tip={viewportLabel} aria-label={viewportLabel} aria-pressed={mobile} onClick={handleToggleViewport}>
          {mobile ? <DesktopIcon /> : <MobileIcon />}
        </button>
        <button type="button" className={SECONDARY_BUTTON} data-tip="Outils de développement" aria-label="Outils de développement" onClick={handleDevTools}>
          <DevToolsIcon />
        </button>
        <span className="mx-1 h-3 w-px bg-tily-line @max-[280px]:hidden" aria-hidden="true" />
        <button type="button" className={HEADER_BUTTON} data-tip="Split côte à côte (Ctrl + Maj + D)" aria-label="Split côte à côte" onClick={ignoringRepeatedClicks(handleSplitSideBySide)}>
          <SplitIcon horizontal />
        </button>
        <button type="button" className={HEADER_BUTTON} data-tip="Split haut / bas (Ctrl + Maj + H)" aria-label="Split haut / bas" onClick={ignoringRepeatedClicks(handleSplitTopBottom)}>
          <SplitIcon horizontal={false} />
        </button>
        {zoomed && (
          <button type="button" className={`${HEADER_BUTTON} text-tily-green`} data-tip="Réduire le pane et revoir les autres (Ctrl + Maj + M)" aria-label="Réduire le pane" onClick={handleToggleZoom}>
            <UnzoomIcon />
          </button>
        )}
        <button type="button" className={`${HEADER_BUTTON} hover:text-tily-error`} data-tip="Fermer le pane (Ctrl + Maj + X)" aria-label="Fermer le pane" onClick={ignoringRepeatedClicks(handleClose)}>
          <CloseIcon />
        </button>
      </header>
      <div data-browser-body={pane.id} className="relative min-h-0 overflow-hidden" onMouseDown={handleBodyMouseDown}>
        {snapshot && <img src={snapshot} alt="" className="mx-auto block h-full" style={{ width: mobile ? 'min(390px, 100%)' : '100%' }} onLoad={handleSnapshotLoad} />}
        {failure && <p className="absolute inset-x-4 top-4 rounded border border-tily-line bg-tily-panel p-3 text-sm text-tily-error">{failure}</p>}
      </div>
    </section>
  )
})
