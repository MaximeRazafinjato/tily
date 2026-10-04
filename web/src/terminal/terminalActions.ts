import type { Terminal } from '@xterm/xterm'
import { longestWaitingFirst, waitingPanes } from '../agents/agentSummary'
import { focusBrowser, isBrowserStarted } from '../browser/browserLayer'
import { activeTab, activeWorkspace, RightPanelView } from '../model/session'
import { useAgentStore } from '../store/agentStore'
import { useGitStore } from '../store/gitStore'
import { usePaneStore } from '../store/paneStore'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { usePasteStore } from '../store/pasteStore'
import { useSessionStore } from '../store/sessionStore'
import { CommandDirection, lastCommandOutput, OutputFailure, scrollToCommand } from './commandOutput'
import { terminalRegistry } from './terminalRegistry'

const COPY_FAILED = 'Copie dans le presse-papiers impossible.'
const PASTE_FAILED = 'Lecture du presse-papiers impossible.'
const NO_MOUSE_TRACKING = 'none'
const OVERLAY_DEFAULT_SELECTOR = '[data-overlay-default]'
const TABBABLE = 0
const UNTABBABLE = -1
const VIEWPORT_SELECTOR = '.xterm-viewport'
const TAB_INDEX_ATTRIBUTE = 'tabindex'
const AGENT_LINE_BREAK = '\x1b\r'
const RUN_KEY = '\r'
const LINE_BREAK = '\n'

const PASTED_LINE_BREAK = /\r\n|\r|\n/
const TRAILING_LINE_BREAK = /(\r\n|\r|\n)$/
const SEVERAL_LINES_NOT_RUN = 'Plusieurs lignes : Ctrl + Maj + Entrée n’exécute qu’une ligne. Ctrl + Entrée les colle avec confirmation.'
const PASTE_CANCELLED = 'Collage annulé : rien n’a été envoyé au terminal.'

const reportFailure = (message: string) => (): void => useHostStore.getState().setStatus(message, StatusLevel.Error)

const pasteGuarded = (paneId: string, terminal: Terminal, text: string): void => {
  const lines = text.replace(TRAILING_LINE_BREAK, '').split(PASTED_LINE_BREAK)
  if (lines.length > 1 && !terminal.modes.bracketedPasteMode) {
    usePasteStore.getState().ask({ paneId, text, lines })
  } else {
    terminal.paste(text)
  }
}

export const confirmPaste = (): void => {
  const { request, clear } = usePasteStore.getState()
  clear()
  if (request) {
    terminalRegistry.get(request.paneId)?.terminal.paste(request.text)
    focusPane(request.paneId)
  }
}

export const cancelPaste = (): void => {
  const { request, clear } = usePasteStore.getState()
  clear()
  useHostStore.getState().setStatus(PASTE_CANCELLED)
  if (request) {
    focusPane(request.paneId)
  }
}

const OUTPUT_FAILURES: Record<OutputFailure, string> = {
  [OutputFailure.NoCommand]: 'Aucune commande terminée dans ce terminal depuis son ouverture (Windows PowerShell et PowerShell 7 uniquement).',
  [OutputFailure.Trimmed]: 'La sortie de la dernière commande n’est plus dans l’historique du terminal.',
  [OutputFailure.Empty]: 'La dernière commande n’a rien affiché.',
}

const lineCountLabel = (text: string): string => {
  const count = text.split(LINE_BREAK).length
  return count === 1 ? '1 ligne' : `${count} lignes`
}

export const copyLastCommandOutput = (paneId: string): void => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  if (!terminal) {
    return
  }
  const output = lastCommandOutput(terminal)
  if ('failure' in output) {
    useHostStore.getState().setStatus(OUTPUT_FAILURES[output.failure])
    return
  }
  void navigator.clipboard
    .writeText(output.text)
    .then(() => useHostStore.getState().setStatus(`Sortie de la dernière commande copiée (${lineCountLabel(output.text)}).`))
    .catch(reportFailure(COPY_FAILED))
}

const NO_COMMAND_ABOVE = 'Aucune commande plus haut dans ce terminal (Windows PowerShell et PowerShell 7 uniquement).'

export const scrollPaneToCommand = (paneId: string, direction: CommandDirection): void => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  if (terminal && !scrollToCommand(terminal, direction) && direction === CommandDirection.Previous) {
    useHostStore.getState().setStatus(NO_COMMAND_ABOVE)
  }
}

const SCROLLBACK_CLEARED = 'Historique de défilement effacé : seul l’écran visible du terminal est conservé.'
const FULL_SCREEN_PROGRAM = 'Le terminal affiche un programme plein écran : quittez-le pour effacer l’historique de défilement.'

export const clearPaneScrollback = (paneId: string): void => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  if (!terminal) {
    return
  }
  if (terminal.buffer.active.type === 'alternate') {
    useHostStore.getState().setStatus(FULL_SCREEN_PROGRAM)
    return
  }
  terminalRegistry.clearScrollback(paneId, () => useHostStore.getState().setStatus(SCROLLBACK_CLEARED))
}

export const isPaneOnAlternateScreen = (paneId: string): boolean => terminalRegistry.get(paneId)?.terminal.buffer.active.type === 'alternate'

const NOTHING_TO_SEND = 'Ligne vide : rien à envoyer au terminal.'
const PANE_BUSY = 'Le terminal actif affiche un message : rien n’y a été envoyé.'

export const sendTextToActivePane = (text: string, execute = false): void => {
  const { session } = useSessionStore.getState()
  const workspace = session ? activeWorkspace(session) : undefined
  const paneId = workspace ? activeTab(workspace).active : undefined
  const terminal = paneId ? terminalRegistry.get(paneId)?.terminal : undefined
  if (text.trim().length === 0) {
    useHostStore.getState().setStatus(NOTHING_TO_SEND)
  } else if (!paneId || !terminal || usePaneStore.getState().states[paneId]) {
    useHostStore.getState().setStatus(PANE_BUSY)
  } else if (execute && PASTED_LINE_BREAK.test(text)) {
    useHostStore.getState().setStatus(SEVERAL_LINES_NOT_RUN)
  } else if (execute) {
    focusPane(paneId)
    terminal.paste(text)
    terminal.input(RUN_KEY)
  } else {
    focusPane(paneId)
    pasteGuarded(paneId, terminal, text)
  }
}

export const hasPaneSelection = (paneId: string): boolean => terminalRegistry.get(paneId)?.terminal.hasSelection() ?? false

export const copyPaneSelection = (paneId: string): void => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  if (terminal?.hasSelection()) {
    void navigator.clipboard.writeText(terminal.getSelection()).catch(reportFailure(COPY_FAILED))
    terminal.clearSelection()
  }
}

export const pasteTextIntoPane = (paneId: string, text: string): void => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  if (terminal && text.length > 0) {
    pasteGuarded(paneId, terminal, text)
  }
}

export const pasteIntoPane = (paneId: string): void => {
  void navigator.clipboard
    .readText()
    .then((text) => pasteTextIntoPane(paneId, text))
    .catch(reportFailure(PASTE_FAILED))
}

export const hasPaneAgent = (paneId: string): boolean => paneId in useAgentStore.getState().agents

export const insertAgentLineBreak = (paneId: string): void => terminalRegistry.get(paneId)?.terminal.input(AGENT_LINE_BREAK)

export const selectAllInPane = (paneId: string): void => terminalRegistry.get(paneId)?.terminal.selectAll()

export const isMouseTrackedByProgram = (paneId: string): boolean => (terminalRegistry.get(paneId)?.terminal.modes.mouseTrackingMode ?? NO_MOUSE_TRACKING) !== NO_MOUSE_TRACKING

const overlayDefaultOf = (paneId: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-pane-id="${CSS.escape(paneId)}"] ${OVERLAY_DEFAULT_SELECTOR}`)

export const focusPane = (paneId: string): void => {
  const overlayDefault = overlayDefaultOf(paneId)
  if (isBrowserStarted(paneId)) {
    focusBrowser(paneId)
  } else if (overlayDefault) {
    overlayDefault.focus()
  } else {
    terminalRegistry.get(paneId)?.terminal.focus()
  }
}

export const setPaneTerminalTabbable = (paneId: string, tabbable: boolean): void => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  const viewport = terminal?.element?.querySelector<HTMLElement>(VIEWPORT_SELECTOR)
  if (terminal?.textarea) {
    terminal.textarea.tabIndex = tabbable ? TABBABLE : UNTABBABLE
  }
  if (viewport && tabbable) {
    viewport.removeAttribute(TAB_INDEX_ATTRIBUTE)
  } else if (viewport) {
    viewport.tabIndex = UNTABBABLE
  }
}

export const insertIntoPane = (paneId: string, text: string): void => {
  const terminal = terminalRegistry.get(paneId)?.terminal
  if (terminal && text.length > 0) {
    useSessionStore.getState().selectPane(paneId)
    terminal.paste(text)
    terminal.focus()
  }
}

const activeTabShowsGit = (): boolean => {
  const { session } = useSessionStore.getState()
  const workspace = session ? activeWorkspace(session) : undefined
  const tab = workspace ? activeTab(workspace) : undefined
  return Boolean(tab?.explorer) && tab?.panel === RightPanelView.Git
}

export const joinPane = (paneId: string): void => {
  useAgentStore.getState().acknowledge(paneId)
  useSessionStore.getState().selectPane(paneId)
  if (activeTabShowsGit()) {
    useGitStore.getState().setGraphOpen(false)
  }
  focusPane(paneId)
}

const NO_WAITING_AGENT_STATUS = 'Aucun agent en attente.'

export const joinNextWaitingPane = (): void => {
  const { session } = useSessionStore.getState()
  if (!session) {
    return
  }
  const { agents, since } = useAgentStore.getState()
  const ordered = longestWaitingFirst(waitingPanes(session, agents), since, Date.now()).map((pane) => pane.paneId)
  const workspace = activeWorkspace(session)
  const paneId = ordered[(ordered.indexOf(workspace ? activeTab(workspace).active : '') + 1) % ordered.length]
  if (paneId) {
    joinPane(paneId)
  } else {
    useHostStore.getState().setStatus(NO_WAITING_AGENT_STATUS)
  }
}
