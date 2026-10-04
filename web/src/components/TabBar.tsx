import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ShellProfile } from '../bridge/messages'
import { tabAgents } from '../agents/agentSummary'
import { BrowserPlacement, openBrowser } from '../browser/browserActions'
import { activePane, DEFAULT_SHELL, paneCountLabel, panesOf, type Workspace } from '../model/session'
import { useAgentStore } from '../store/agentStore'
import { useUiStore } from '../store/uiStore'
import { AgentOwnerMark } from './AgentOwnerMark'
import { AgentStateIcon } from './AgentStateIcon'
import { CommandNoticeIcon } from './CommandNoticeIcon'
import { tabCommandNotice } from '../terminal/commandNotices'
import { useCommandStore } from '../store/commandStore'
import { closeTabsToRightKeepingText } from '../terminal/tabLifecycle'
import { focusActivePaneIfLost } from '../explorer/fileExplorerActions'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { InlineNameEditor } from './InlineNameEditor'
import { ShellMenu } from './ShellMenu'
import { TabContextMenu, type TabMenuActions, type TabMenuRequest } from './TabContextMenu'
import { beginTabDrag, isDropTarget, type MoveTabHandler } from './tabDrag'

interface TabBarProps {
  workspace: Workspace
  shells: ShellProfile[]
  renamingTabId: string | null
  panelOpen: boolean
  onTogglePanel: () => void
  onSelect: (tabId: string) => void
  onStartRename: (tabId: string) => void
  onCommitRename: (name: string) => void
  onCancelRename: () => void
  onClose: (tabId: string) => void
  onCloseOthers: (tabId: string) => void
  onShift: (tabId: string, offset: number) => void
  onDuplicate: (tabId: string) => void
  onNew: (shellId: string) => void
  onMove: MoveTabHandler
}

const MIDDLE_BUTTON = 1
const RENAME_KEY = 'F2'
const NEIGHBOUR_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }

const tabSelector = (tabId: string): string => `[data-drop-tab="${tabId}"]`
const FADE_WIDTH = '24px'
const FADE_TOLERANCE_PX = 8
const NO_FADE = { start: false, end: false }

interface StripFade {
  start: boolean
  end: boolean
}

const fadeOf = (strip: HTMLElement): StripFade => ({
  start: strip.scrollLeft > FADE_TOLERANCE_PX,
  end: strip.scrollWidth - strip.scrollLeft - strip.clientWidth > FADE_TOLERANCE_PX,
})

const maskOf = ({ start, end }: StripFade): string | undefined => {
  if (!start && !end) {
    return undefined
  }
  const head = start ? `transparent, black ${FADE_WIDTH}` : 'black'
  const tail = end ? `black calc(100% - ${FADE_WIDTH}), transparent` : 'black'
  return `linear-gradient(to right, ${head}, ${tail})`
}

const isMenuKey = (event: KeyboardEvent): boolean => (event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu'

const focusNeighbourTab = (tabButton: HTMLElement, offset: number): void => {
  const tabButtons = [...(tabButton.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])]
  tabButtons[tabButtons.indexOf(tabButton) + offset]?.focus()
}

export function TabBar({ workspace, shells, renamingTabId, panelOpen, onTogglePanel, onSelect, onStartRename, onCommitRename, onCancelRename, onClose, onCloseOthers, onShift, onDuplicate, onNew, onMove }: TabBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [tabMenu, setTabMenu] = useState<TabMenuRequest | null>(null)
  const [fade, setFade] = useState<StripFade>(NO_FADE)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const pressedEmptyRef = useRef(false)
  const { draggingTabId, tabDropTarget } = useUiStore(useShallow((state) => ({ draggingTabId: state.draggingTabId, tabDropTarget: state.tabDropTarget })))
  const agents = useAgentStore((state) => state.agents)
  const commandNotices = useCommandStore((state) => state.notices)
  const activeIndex = workspace.tabs.findIndex((tab) => tab.id === workspace.active)

  const updateFade = (strip: HTMLElement) => {
    const next = fadeOf(strip)
    setFade((current) => (current.start === next.start && current.end === next.end ? current : next))
  }

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) {
      return
    }
    const revealActiveTab = () => {
      strip.querySelector(tabSelector(workspace.active))?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      updateFade(strip)
    }
    const observer = new ResizeObserver(revealActiveTab)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [workspace.active, workspace.tabs.length, activeIndex])

  const handleNewDefault = () => onNew(DEFAULT_SHELL)
  const isEmptyArea = (event: MouseEvent<HTMLDivElement>) => event.target === event.currentTarget || event.target === stripRef.current
  const handleBarMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.detail === 1) {
      pressedEmptyRef.current = isEmptyArea(event)
    }
  }
  const handleEmptyDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (pressedEmptyRef.current && isEmptyArea(event)) {
      handleNewDefault()
    }
  }
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    setMenuOpen(true)
  }
  const handleAddKeyDown = (event: KeyboardEvent) => {
    if (isMenuKey(event)) {
      event.preventDefault()
      setMenuOpen(true)
    }
  }
  const handleCloseMenu = useCallback(() => {
    setMenuOpen(false)
    addButtonRef.current?.focus()
  }, [])
  const handleSelectShell = (shellId: string) => {
    setMenuOpen(false)
    onNew(shellId)
  }
  const handleNewBrowser = () => {
    setMenuOpen(false)
    openBrowser(BrowserPlacement.Tab)
  }
  const tabMenuPosition = tabMenu ? workspace.tabs.findIndex((tab) => tab.id === tabMenu.tabId) : -1
  const tabMenuActions: TabMenuActions = { rename: onStartRename, shift: onShift, duplicate: onDuplicate, close: onClose, closeOthers: onCloseOthers, closeToRight: closeTabsToRightKeepingText }
  const handleRunTabMenu = useCallback(() => {
    setTabMenu(null)
    requestAnimationFrame(focusActivePaneIfLost)
  }, [])
  const handleDismissTabMenu = useCallback(() => {
    const returnFocus = tabMenu?.returnFocus
    setTabMenu(null)
    if (returnFocus?.isConnected) {
      returnFocus.focus()
    }
  }, [tabMenu])
  const handleStripScroll = () => {
    if (stripRef.current) {
      updateFade(stripRef.current)
    }
  }
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (stripRef.current && event.deltaY !== 0) {
      stripRef.current.scrollLeft += event.deltaY
    }
  }
  const dropLine = (targeted: boolean) => `h-6 w-0.5 shrink-0 rounded ${targeted ? 'bg-tily-focus' : 'bg-transparent'}`

  return (
    <div data-drop-workspace={workspace.id} className="flex shrink-0 items-center gap-0.5 px-2 pt-1 select-none" onMouseDown={handleBarMouseDown} onDoubleClick={handleEmptyDoubleClick}>
      <div ref={stripRef} role="tablist" className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]" style={{ maskImage: maskOf(fade) }} onWheel={handleWheel} onScroll={handleStripScroll}>
        {workspace.tabs.map((tab) => {
          const active = tab.id === workspace.active
          const targeted = isDropTarget(tabDropTarget, workspace.id, tab.id)
          const agentSummary = tabAgents(tab, agents)
          const commandNotice = tabCommandNotice(tab, commandNotices)
          const handleSelect = () => onSelect(tab.id)
          const handleStartRename = () => onStartRename(tab.id)
          const handleClose = () => onClose(tab.id)
          const handleAuxClick = (event: MouseEvent) => {
            if (event.button === MIDDLE_BUTTON) {
              event.preventDefault()
              onClose(tab.id)
            }
          }
          const handlePointerDown = (event: PointerEvent<HTMLElement>) => beginTabDrag(event, tab.id, onMove)
          const handleTabContextMenu = (event: MouseEvent) => {
            event.preventDefault()
            setTabMenu({ tabId: tab.id, x: event.clientX, y: event.clientY, returnFocus: null })
          }
          const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
            if (isMenuKey(event)) {
              event.preventDefault()
              const { left, bottom } = event.currentTarget.getBoundingClientRect()
              setTabMenu({ tabId: tab.id, x: left, y: bottom, returnFocus: event.currentTarget })
            } else if (event.key === RENAME_KEY) {
              event.preventDefault()
              onStartRename(tab.id)
            } else if (event.key in NEIGHBOUR_KEYS && !event.ctrlKey && !event.shiftKey) {
              event.preventDefault()
              if (event.altKey) {
                onShift(tab.id, NEIGHBOUR_KEYS[event.key])
              } else {
                focusNeighbourTab(event.currentTarget, NEIGHBOUR_KEYS[event.key])
              }
            }
          }
          return (
            <Fragment key={tab.id}>
              <span aria-hidden="true" className={dropLine(targeted)} />
              <div
                data-drop-workspace={workspace.id}
                data-drop-tab={tab.id}
                className={`flex min-w-[100px] items-center rounded-t-md border border-b-0 ${active ? 'border-tily-line bg-tily-panel text-tily-green-deep' : 'border-transparent text-tily-muted hover:bg-tily-green-hover'} ${draggingTabId === tab.id ? 'opacity-50' : ''}`}
                onAuxClick={handleAuxClick}
                onContextMenu={handleTabContextMenu}
              >
                {tab.id === renamingTabId ? (
                  <InlineNameEditor value={tab.name} label="Nom de l’onglet" className="mx-1 my-1 min-w-0 flex-1 text-xs" onCommit={onCommitRename} onCancel={onCancelRename} />
                ) : (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-tip={`${tab.name} · ${activePane(tab).path} · ${paneCountLabel(panesOf(tab.tree).length)} · Double-clic pour renommer, glisser pour déplacer`}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 px-3 py-2 text-left text-xs"
                    onClick={handleSelect}
                    onDoubleClick={handleStartRename}
                    onPointerDown={handlePointerDown}
                    onKeyDown={handleTabKeyDown}
                  >
                    {agentSummary ? <AgentStateIcon state={agentSummary.state} tip={agentSummary.tip} /> : commandNotice && <CommandNoticeIcon notice={commandNotice} />}
                    <span className="min-w-0 truncate">{tab.name}</span>
                    {tab.owner && <AgentOwnerMark owner={tab.owner} compact />}
                  </button>
                )}
                <button type="button" className="shrink-0 cursor-pointer px-2 text-xs hover:text-tily-error" data-tip="Fermer l’onglet" onClick={handleClose}>
                  ×
                </button>
              </div>
            </Fragment>
          )
        })}
        <span aria-hidden="true" className={dropLine(isDropTarget(tabDropTarget, workspace.id))} />
      </div>
      <div className="relative shrink-0">
        <button
          ref={addButtonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="cursor-pointer rounded px-2 py-1 text-base hover:bg-tily-green-hover"
          data-tip="Nouvel onglet PowerShell (Ctrl + Maj + T ; clic droit : choisir le shell ou un navigateur ; double-clic dans l’espace vide de la barre : nouvel onglet)"
          onClick={handleNewDefault}
          onContextMenu={handleContextMenu}
          onKeyDown={handleAddKeyDown}
        >
          +
        </button>
        {menuOpen && <ShellMenu shells={shells} onSelect={handleSelectShell} onBrowser={handleNewBrowser} onClose={handleCloseMenu} />}
      </div>
      <button
        type="button"
        aria-pressed={panelOpen}
        aria-label={panelOpen ? 'Masquer le panneau de droite' : 'Afficher le panneau de droite'}
        className={`mb-1 ml-auto flex h-[26px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-xs hover:bg-tily-green-hover hover:text-tily-ink ${panelOpen ? 'text-tily-green-deep' : 'text-tily-muted'}`}
        data-tip={`${panelOpen ? 'Masquer' : 'Afficher'} le panneau Fichiers / Git / Notes (Ctrl + Maj + E, G ou O)`}
        onClick={onTogglePanel}
      >
        <Icon name={IconName.Explorer} size={14} />
        <span>Fichiers / Git / Notes</span>
      </button>
      {tabMenu && (
        <TabContextMenu
          request={tabMenu}
          position={tabMenuPosition}
          count={workspace.tabs.length}
          actions={tabMenuActions}
          onRun={handleRunTabMenu}
          onDismiss={handleDismissTabMenu}
        />
      )}
    </div>
  )
}
