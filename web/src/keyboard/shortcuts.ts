import { bridge } from '../bridge/bridge'
import { BrowserPlacement, openBrowser } from '../browser/browserActions'
import { useHostStore } from '../store/hostStore'
import { activePane, activeTab, activeWorkspace, DEFAULT_SHELL, RightPanelView, SplitAxis, type Workspace } from '../model/session'
import { Direction } from '../components/paneNavigation'
import { equalizeActiveTab, focusPaneToward, selectTabNumber, swapPaneToward } from './paneCommands'
import { focusWorkspacePanel } from '../components/workspacePanel'
import { useSessionStore } from '../store/sessionStore'
import { requestApplicationClose } from '../terminal/closeGuard'
import { closePaneKeepingText, movePaneToNewTab, openClaudeTab, restoreClosedTab } from '../terminal/tabLifecycle'
import { focusPane, joinNextWaitingPane, scrollPaneToCommand } from '../terminal/terminalActions'
import { CommandDirection } from '../terminal/commandOutput'
import { togglePaneZoom } from '../terminal/paneZoom'
import { openPaneSearch } from '../terminal/paneSearch'
import { openGlobalSearch } from '../terminal/globalSearch'
import { togglePanelView } from '../panel/rightPanel'
import { RenameOrigin, useUiStore } from '../store/uiStore'
import { startWorktreeCreation } from '../worktree/worktreeActions'
import { openProjectPicker } from '../project/projectOpenActions'
import { toggleStatusLog } from '../statusLog/statusLogActions'
import { useShortcutStore } from '../store/shortcutStore'
import { Command } from './commands'
import { runContextCommand } from './contextCommands'
import { chordOf, isModifierKey, leaderKeyOf } from './keyChords'

export { Command }

const MS_PER_SECOND = 1000
const CANCEL_KEY = 'Escape'
const ENTER_KEY = 'Enter'
const SHORTCUT_BLOCKERS = 'input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"], [role="alertdialog"]'
const TAB_NUMBER_CODE = /^Digit([1-9])$/
const KEYPAD_NUMBER_CODE = /^Numpad([1-9])$/
const LEADER_EXPIRED_STATUS = 'Leader expiré : la saisie revient au terminal.'

let leaderTimer: ReturnType<typeof setTimeout> | undefined

const letterOf = (event: KeyboardEvent): string => {
  if (/^[a-zA-Z]$/.test(event.key)) {
    return event.key.toLowerCase()
  }
  const fromCode = /^Key([A-Z])$/.exec(event.code)
  return fromCode ? fromCode[1].toLowerCase() : event.key.toLowerCase()
}

const isLeaderChord = (event: KeyboardEvent): boolean => chordOf(event) === useShortcutStore.getState().settings.leader

const isCloseWindow = (event: KeyboardEvent): boolean => event.altKey && event.key === 'F4'
const isCopy = (event: KeyboardEvent): boolean => event.ctrlKey && event.shiftKey && !event.altKey && letterOf(event) === 'c'
const isPlainCtrlC = (event: KeyboardEvent): boolean => event.ctrlKey && !event.shiftKey && !event.altKey && letterOf(event) === 'c'
const isPaste = (event: KeyboardEvent): boolean => event.ctrlKey && !event.altKey && letterOf(event) === 'v'
const isAgentLineBreak = (event: KeyboardEvent): boolean => event.key === ENTER_KEY && !event.altKey && !event.metaKey && event.shiftKey !== event.ctrlKey

const directCommand = (event: KeyboardEvent): Command | undefined => {
  const chord = chordOf(event)
  return chord ? useShortcutStore.getState().directIndex[chord] : undefined
}

export const isPaletteShortcut = (event: KeyboardEvent): boolean => directCommand(event) === Command.Palette

export const isPaneSearchShortcut = (event: KeyboardEvent): boolean => directCommand(event) === Command.SearchPane

export const isCommandShortcut = (event: KeyboardEvent, command: Command): boolean => directCommand(event) === command

const exitLeader = (): void => {
  clearTimeout(leaderTimer)
  useHostStore.getState().setLeaderActive(false)
}

const expireLeader = (): void => {
  exitLeader()
  useHostStore.getState().setStatus(LEADER_EXPIRED_STATUS)
}

const enterLeader = (): void => {
  useHostStore.getState().setLeaderActive(true)
  clearTimeout(leaderTimer)
  leaderTimer = setTimeout(expireLeader, useShortcutStore.getState().settings.leaderTimeoutSeconds * MS_PER_SECOND)
}

const tabNumberOf = (event: KeyboardEvent): number | undefined => {
  const digit = TAB_NUMBER_CODE.exec(event.code)
  const keypadDigit = KEYPAD_NUMBER_CODE.exec(event.code)
  const number = digit?.[1] ?? (keypadDigit && event.key === keypadDigit[1] ? keypadDigit[1] : undefined)
  return number ? Number(number) : undefined
}

const decideInLeader = (event: KeyboardEvent): boolean => {
  if (isModifierKey(event)) {
    return false
  }
  exitLeader()
  if (isLeaderChord(event)) {
    return true
  }
  if (event.key === CANCEL_KEY) {
    return false
  }
  const key = leaderKeyOf(event)
  const command = key ? useShortcutStore.getState().leaderIndex[key] : undefined
  if (command) {
    runCommand(command)
    return false
  }
  const tabNumber = tabNumberOf(event)
  if (tabNumber && !event.ctrlKey && !event.altKey) {
    selectTabNumber(tabNumber)
    return false
  }
  return true
}

const currentWorkspace = (): Workspace | undefined => {
  const { session } = useSessionStore.getState()
  return session ? activeWorkspace(session) : undefined
}

const currentShell = (): string => {
  const workspace = currentWorkspace()
  return workspace ? activePane(activeTab(workspace)).shell : DEFAULT_SHELL
}

const currentPaneId = (): string => {
  const workspace = currentWorkspace()
  return workspace ? activeTab(workspace).active : ''
}

const SIDEBAR_SELECTOR = 'aside'

export const revealWorkspacePanel = (): void => {
  const { session, toggleSidebar: toggle } = useSessionStore.getState()
  if (session?.sidebarCollapsed) {
    toggle()
  }
  requestAnimationFrame(() => focusWorkspacePanel(currentWorkspace()?.id))
}

const toggleSidebar = (): void => {
  const { session, toggleSidebar: toggle } = useSessionStore.getState()
  if (session?.sidebarCollapsed) {
    revealWorkspacePanel()
    return
  }
  if (document.activeElement?.closest(SIDEBAR_SELECTOR)) {
    focusPane(currentPaneId())
  }
  toggle()
}

const openSettings = (): void => {
  bridge.send({ type: 'settings.get' })
  useUiStore.getState().openSettings()
}

const FOCUS_DIRECTIONS: Partial<Record<Command, Direction>> = {
  [Command.FocusPaneLeft]: Direction.Left,
  [Command.FocusPaneRight]: Direction.Right,
  [Command.FocusPaneUp]: Direction.Up,
  [Command.FocusPaneDown]: Direction.Down,
}

const SWAP_DIRECTIONS: Partial<Record<Command, Direction>> = {
  [Command.SwapPaneLeft]: Direction.Left,
  [Command.SwapPaneRight]: Direction.Right,
  [Command.SwapPaneUp]: Direction.Up,
  [Command.SwapPaneDown]: Direction.Down,
}

export const runCommand = (command: Command): void => {
  const focusDirection = FOCUS_DIRECTIONS[command]
  const swapDirection = SWAP_DIRECTIONS[command]
  if (focusDirection) {
    focusPaneToward(focusDirection)
    return
  }
  if (swapDirection) {
    swapPaneToward(swapDirection)
    return
  }
  const sessionStore = useSessionStore.getState()
  const hostStore = useHostStore.getState()
  switch (command) {
    case Command.Palette:
      useUiStore.getState().openPalette()
      break
    case Command.NewTab:
      sessionStore.newTab(currentShell())
      break
    case Command.NewClaudeTab:
      openClaudeTab(currentShell())
      break
    case Command.SplitSideBySide:
      sessionStore.splitPane(SplitAxis.Horizontal)
      break
    case Command.SplitTopBottom:
      sessionStore.splitPane(SplitAxis.Vertical)
      break
    case Command.NewWorkspace:
      useUiStore.getState().startRenamingWorkspace(sessionStore.newWorkspace(`Workspace ${(sessionStore.session?.workspaces.length ?? 0) + 1}`, hostStore.home, DEFAULT_SHELL), RenameOrigin.Header)
      break
    case Command.Settings:
      openSettings()
      break
    case Command.SettingsExport:
      openSettings()
      bridge.send({ type: 'settings.export' })
      break
    case Command.SettingsImport:
      openSettings()
      bridge.send({ type: 'settings.import' })
      break
    case Command.FocusSidebar:
      revealWorkspacePanel()
      break
    case Command.Projects:
      openProjectPicker()
      break
    case Command.ClosePane:
      closePaneKeepingText(currentPaneId())
      break
    case Command.MoveTabLeft:
      sessionStore.moveActiveTab(-1)
      break
    case Command.MoveTabRight:
      sessionStore.moveActiveTab(1)
      break
    case Command.NextTab:
      sessionStore.selectAdjacentTab(1)
      break
    case Command.PreviousTab:
      sessionStore.selectAdjacentTab(-1)
      break
    case Command.RestoreTab:
      restoreClosedTab()
      break
    case Command.ToggleExplorer:
      togglePanelView(RightPanelView.Files, true)
      break
    case Command.ToggleGit:
      togglePanelView(RightPanelView.Git, true)
      break
    case Command.ToggleNotes:
      togglePanelView(RightPanelView.Notes, true)
      break
    case Command.ToggleStatusLog:
      toggleStatusLog()
      break
    case Command.ToggleSidebar:
      toggleSidebar()
      break
    case Command.TogglePaneZoom:
      togglePaneZoom()
      break
    case Command.PreviousCommand:
      scrollPaneToCommand(currentPaneId(), CommandDirection.Previous)
      break
    case Command.NextCommand:
      scrollPaneToCommand(currentPaneId(), CommandDirection.Next)
      break
    case Command.EqualizePanes:
      equalizeActiveTab()
      break
    case Command.MovePaneToNewTab:
      movePaneToNewTab(currentPaneId())
      break
    case Command.JoinWaitingAgent:
      joinNextWaitingPane()
      break
    case Command.CreateWorktree:
      startWorktreeCreation()
      break
    case Command.OpenBrowser:
      openBrowser(BrowserPlacement.Beside)
      break
    case Command.SearchPane:
      openPaneSearch(currentPaneId())
      break
    case Command.SearchTerminals:
      openGlobalSearch()
      break
    default:
      runContextCommand(command)
  }
}

export const handleForwardedKey = (event: KeyboardEvent): void => {
  if (isCloseWindow(event)) {
    requestApplicationClose()
    return
  }
  if (isLeaderChord(event)) {
    enterLeader()
    return
  }
  const command = directCommand(event)
  if (command) {
    runCommand(command)
  }
}

export const handleLeaderKeyCapture = (event: KeyboardEvent): void => {
  if (!useHostStore.getState().leaderActive || event.isComposing || isModifierKey(event) || (event.target instanceof Element && event.target.closest(SHORTCUT_BLOCKERS))) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  decideInLeader(event)
}

export const handleDocumentShortcut = (event: KeyboardEvent): void => {
  if (event.defaultPrevented || event.isComposing || useHostStore.getState().leaderActive || (event.target instanceof Element && event.target.closest(SHORTCUT_BLOCKERS))) {
    return
  }
  if (isLeaderChord(event)) {
    event.preventDefault()
    enterLeader()
    return
  }
  const command = directCommand(event)
  if (command) {
    event.preventDefault()
    runCommand(command)
  }
}

const isReservedShortcut = (event: KeyboardEvent): boolean =>
  isLeaderChord(event) || isCloseWindow(event) || isCopy(event) || isPaste(event) || directCommand(event) !== undefined

const COMMAND_NAVIGATION = new Set([Command.PreviousCommand, Command.NextCommand])

export interface ShortcutActions {
  hasSelection: () => boolean
  copySelection: () => void
  pasteClipboard: () => void
  hasAgent: () => boolean
  insertAgentLineBreak: () => void
  usesAlternateScreen: () => boolean
}

export const handleTerminalKey = (event: KeyboardEvent, actions: ShortcutActions): boolean => {
  const passToTerminal = decide(event, actions)
  if (!passToTerminal) {
    event.preventDefault()
    event.stopPropagation()
  }
  return passToTerminal
}

const decide = (event: KeyboardEvent, actions: ShortcutActions): boolean => {
  if (event.isComposing) {
    return true
  }
  if (event.type !== 'keydown') {
    return !isReservedShortcut(event)
  }
  if (isCloseWindow(event)) {
    requestApplicationClose()
    return false
  }
  if (useHostStore.getState().leaderActive) {
    return decideInLeader(event)
  }
  if (isLeaderChord(event)) {
    enterLeader()
    return false
  }
  if (isCopy(event) || (isPlainCtrlC(event) && actions.hasSelection())) {
    actions.copySelection()
    return false
  }
  if (isPaste(event)) {
    actions.pasteClipboard()
    return false
  }
  if (isAgentLineBreak(event) && actions.hasAgent()) {
    actions.insertAgentLineBreak()
    return false
  }
  const command = directCommand(event)
  if (command && !(COMMAND_NAVIGATION.has(command) && actions.usesAlternateScreen())) {
    runCommand(command)
    return false
  }
  return true
}
