import { Terminal, type IMarker } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { ClipboardAddon } from '@xterm/addon-clipboard'
import { SerializeAddon } from '@xterm/addon-serialize'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { bridge } from '../bridge/bridge'
import { DEFAULT_FONT_SIZE } from '../model/appearance'
import { allPanes, type Pane } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { COMMAND_DONE_OSC, receiveCommandDone } from './commandNotices'
import { trackCommandOutput } from './commandOutput'
import { registerFileLinks } from './fileLinks'

const ACK_THRESHOLD = 256 * 1024
const MAX_WEBGL_CONTEXTS = 14
const STABLE_CHUNK_LINES = 1000
const CHUNK_SEPARATOR = '\x1b[0m\r\n'
const SNAPSHOT_SCROLLBACK_LINES = 2000
const DEFAULT_SCROLLBACK_LINES = 10000
const NEWLINE = String.fromCharCode(13, 10)
const ERASE_SCROLLBACK = '\x1b[3J'

export enum RestoreKind {
  Tab = 'tab',
  Session = 'session',
}

const RESTORE_SEPARATORS: Record<RestoreKind, string> = {
  [RestoreKind.Tab]: '\r\n\x1b[2m── Onglet rouvert : ancien texte ci-dessus, nouveau terminal ci-dessous ──\x1b[0m\r\n',
  [RestoreKind.Session]: '\r\n\x1b[2m── Session restaurée — nouvelle session : ancien texte ci-dessus, aucun processus n’a été relancé ──\x1b[0m\r\n',
}
const LINK_PATTERN = /(?:https?|HTTPS?|file|FILE):\/{2,3}[^\s"'!*(){}|\\^<>`]*[^\s"':,.!?{}|\\^~[\]`()<>]/
const FONT_FAMILY = '"CaskaydiaCove Nerd Font Mono", "Cascadia Mono", "Cascadia Code", Consolas, "Symbols Nerd Font Mono", monospace'

enum Renderer {
  WebGl = 'webgl',
  Dom = 'dom',
}

interface TextChunk {
  end: IMarker
  text: string
}

export interface TerminalHandle {
  paneId: string
  terminal: Terminal
  fit: FitAddon
  serializer: SerializeAddon
  renderer: Renderer
  rendererAddon?: WebglAddon
  shownAt: number
  started: boolean
  unackedChars: number
  dirty: boolean
  chunks: TextChunk[]
  keyHandler?: (event: KeyboardEvent) => boolean
}

const handles = new Map<string, TerminalHandle>()
const primedText = new Map<string, { text: string; kind: RestoreKind }>()
const initialCommands = new Map<string, string>()
let scrollbackLines = DEFAULT_SCROLLBACK_LINES
let fontSize = DEFAULT_FONT_SIZE
let webglUnavailable = false

const start = (handle: TerminalHandle, pane: Pane): void => {
  handle.started = true
  const command = initialCommands.get(pane.id)
  initialCommands.delete(pane.id)
  bridge.send({ type: 'terminal.create', pane: pane.id, shell: pane.shell, cwd: pane.path, cols: handle.terminal.cols, rows: handle.terminal.rows, command })
}

const isShown = (handle: TerminalHandle): boolean => handle.terminal.element?.isConnected === true

const releaseRenderer = (handle: TerminalHandle): void => {
  handle.rendererAddon?.dispose()
  handle.rendererAddon = undefined
  handle.renderer = Renderer.Dom
}

const loadWebgl = (handle: TerminalHandle): void => {
  releaseRenderer(handle)
  try {
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => {
      if (handle.rendererAddon === webgl) {
        releaseRenderer(handle)
      }
    })
    handle.terminal.loadAddon(webgl)
    handle.rendererAddon = webgl
    handle.renderer = Renderer.WebGl
  } catch {
    webglUnavailable = true
  }
}

const releaseLeastRecentlyShownWebgl = (): void => {
  const withWebgl = [...handles.values()].filter((handle) => handle.renderer === Renderer.WebGl)
  const excess = withWebgl.length - MAX_WEBGL_CONTEXTS
  if (excess > 0) {
    withWebgl
      .filter((handle) => !isShown(handle))
      .sort((left, right) => left.shownAt - right.shownAt)
      .slice(0, excess)
      .forEach(releaseRenderer)
  }
}

const showWithGpu = (handle: TerminalHandle): void => {
  handle.shownAt = performance.now()
  if (handle.renderer !== Renderer.WebGl && !webglUnavailable) {
    loadWebgl(handle)
    releaseLeastRecentlyShownWebgl()
  }
}

const resyncViewportScroll = (terminal: Terminal): void => {
  const line = terminal.buffer.active.viewportY
  terminal.scrollToTop()
  terminal.scrollToLine(line)
}

const forgetChunks = (handle: TerminalHandle): void => {
  handle.chunks.forEach((chunk) => chunk.end.dispose())
  handle.chunks = []
}

const firstUncachedLine = (handle: TerminalHandle): number => {
  const { terminal } = handle
  handle.chunks = handle.chunks.filter((chunk) => !chunk.end.isDisposed)
  const last = handle.chunks.at(-1)
  return last ? last.end.line + 1 : Math.max(0, terminal.buffer.normal.length - terminal.rows - scrollbackLines)
}

const cacheStableLines = (handle: TerminalHandle, maxLines: number): boolean => {
  const { terminal } = handle
  const buffer = terminal.buffer.normal
  if (terminal.buffer.active !== buffer) {
    return false
  }
  const start = firstUncachedLine(handle)
  const stableEnd = buffer.baseY - 1
  let end = Math.min(stableEnd, start + maxLines - 1)
  while (end >= start && buffer.getLine(end + 1)?.isWrapped) {
    end--
  }
  if (end < start) {
    return false
  }
  const marker = terminal.registerMarker(end - buffer.baseY - buffer.cursorY)
  if (!marker) {
    return false
  }
  handle.chunks.push({ end: marker, text: handle.serializer.serialize({ range: { start, end }, excludeAltBuffer: true, excludeModes: true }) })
  return end < stableEnd
}

const snapshotOf = (handle: TerminalHandle): string => {
  const { terminal, serializer } = handle
  if (terminal.buffer.active !== terminal.buffer.normal) {
    return serializer.serialize({ scrollback: scrollbackLines })
  }
  cacheStableLines(handle, Number.MAX_SAFE_INTEGER)
  const tail = serializer.serialize({ range: { start: firstUncachedLine(handle), end: terminal.buffer.normal.length - 1 }, excludeAltBuffer: true })
  return [...handle.chunks.map((chunk) => chunk.text), tail].join(CHUNK_SEPARATOR)
}

const currentPath = (pane: Pane): string => {
  const { session } = useSessionStore.getState()
  return (session ? allPanes(session).find((candidate) => candidate.id === pane.id)?.path : undefined) ?? pane.path
}

const openLinkOnCtrlClick = (event: MouseEvent, url: string): void => {
  if (event.ctrlKey) {
    bridge.send({ type: 'link.open', url })
  }
}

const createHandle = (pane: Pane): TerminalHandle => {
  const terminal = new Terminal({
    allowProposedApi: true,
    cursorBlink: true,
    fontFamily: FONT_FAMILY,
    fontSize,
    scrollback: scrollbackLines,
    theme: { background: '#121416', foreground: '#cdd1cd', cursor: '#8fb39f', selectionBackground: '#7a9f8b40' },
    linkHandler: { activate: openLinkOnCtrlClick, allowNonHttpProtocols: true },
  })
  const fit = new FitAddon()
  const serializer = new SerializeAddon()
  terminal.loadAddon(fit)
  terminal.loadAddon(serializer)
  terminal.loadAddon(new Unicode11Addon())
  terminal.loadAddon(new ClipboardAddon())
  terminal.loadAddon(new WebLinksAddon(openLinkOnCtrlClick, { urlRegex: LINK_PATTERN }))
  terminal.unicode.activeVersion = '11'
  const handle: TerminalHandle = { paneId: pane.id, terminal, fit, serializer, renderer: Renderer.Dom, shownAt: 0, started: false, unackedChars: 0, dirty: true, chunks: [] }
  terminal.onData((data) => bridge.send({ type: 'terminal.input', pane: pane.id, data }))
  terminal.parser.registerOscHandler(COMMAND_DONE_OSC, (data) => {
    receiveCommandDone(pane.id, data)
    return true
  })
  trackCommandOutput(terminal, () => currentPath(pane))
  registerFileLinks(terminal, pane.id)
  terminal.buffer.onBufferChange(() => forgetChunks(handle))
  terminal.onResize(({ cols, rows }) => {
    forgetChunks(handle)
    if (handle.started) {
      bridge.send({ type: 'terminal.resize', pane: pane.id, cols, rows })
    }
  })
  terminal.attachCustomKeyEventHandler((event) => handle.keyHandler?.(event) ?? true)
  return handle
}

export const terminalRegistry = {
  configure(linesPerPane: number): void {
    scrollbackLines = linesPerPane
  },

  fontSize(): number {
    return fontSize
  },

  setFontSize(size: number): void {
    if (size === fontSize) {
      return
    }
    fontSize = size
    handles.forEach((handle) => {
      handle.terminal.options.fontSize = size
      if (handle.terminal.element?.isConnected) {
        handle.fit.fit()
      }
    })
  },

  get(paneId: string): TerminalHandle | undefined {
    return handles.get(paneId)
  },

  attach(pane: Pane, element: HTMLElement): TerminalHandle {
    let handle = handles.get(pane.id)
    if (!handle) {
      handle = createHandle(pane)
      handles.set(pane.id, handle)
    }
    if (!handle.terminal.element) {
      handle.terminal.open(element)
    } else if (handle.terminal.element.parentElement !== element) {
      element.appendChild(handle.terminal.element)
      resyncViewportScroll(handle.terminal)
    }
    showWithGpu(handle)
    handle.fit.fit()
    if (!handle.started) {
      handle.started = true
      const restored = primedText.get(pane.id)
      if (restored !== undefined) {
        primedText.delete(pane.id)
        handle.terminal.write(restored.text + RESTORE_SEPARATORS[restored.kind] + NEWLINE.repeat(handle.terminal.rows))
      }
      start(handle, pane)
    }
    return handle
  },

  restart(pane: Pane): void {
    const handle = handles.get(pane.id)
    if (handle) {
      handle.terminal.write(NEWLINE)
      start(handle, pane)
    }
  },

  write(paneId: string, data: string): void {
    const handle = handles.get(paneId)
    if (!handle) {
      return
    }
    handle.unackedChars += data.length
    handle.dirty = true
    handle.terminal.write(data, () => {
      if (handle.unackedChars >= ACK_THRESHOLD) {
        bridge.send({ type: 'terminal.ack', pane: paneId, chars: handle.unackedChars })
        handle.unackedChars = 0
      }
    })
  },

  snapshot(paneIds: string[]): Record<string, string> {
    const text: Record<string, string> = {}
    for (const paneId of paneIds) {
      const handle = handles.get(paneId)
      if (handle) {
        text[paneId] = handle.serializer.serialize({ scrollback: SNAPSHOT_SCROLLBACK_LINES })
      }
    }
    return text
  },

  dirtyPaneIds(): string[] {
    return [...handles.values()].filter((handle) => handle.dirty).map((handle) => handle.paneId)
  },

  cacheStableText(paneId: string): boolean {
    const handle = handles.get(paneId)
    return handle ? cacheStableLines(handle, STABLE_CHUNK_LINES) : false
  },

  takeSnapshot(paneId: string): string | undefined {
    const handle = handles.get(paneId)
    if (!handle) {
      return undefined
    }
    handle.dirty = false
    return snapshotOf(handle)
  },

  markAllDirty(): void {
    for (const handle of handles.values()) {
      handle.dirty = true
    }
  },

  unsavedPrimedText(): Record<string, string> {
    return Object.fromEntries([...primedText].filter(([, primed]) => primed.kind === RestoreKind.Tab).map(([paneId, primed]) => [paneId, primed.text]))
  },

  runAtStart(paneId: string, command: string): void {
    initialCommands.set(paneId, command)
  },
  prime(paneId: string, text: string, kind: RestoreKind = RestoreKind.Tab): void {
    primedText.set(paneId, { text, kind })
  },

  clearScrollback(paneId: string, done: () => void): void {
    const handle = handles.get(paneId)
    if (!handle) {
      return
    }
    handle.terminal.write(ERASE_SCROLLBACK, () => {
      forgetChunks(handle)
      handle.dirty = true
      done()
    })
  },

  markExited(paneId: string, code: number): void {
    handles.get(paneId)?.terminal.write(`\r\n\x1b[31m[processus terminé, code ${code}]\x1b[0m\r\n`)
  },

  dispose(paneId: string): void {
    const handle = handles.get(paneId)
    if (!handle) {
      return
    }
    bridge.send({ type: 'terminal.close', pane: paneId })
    handle.terminal.dispose()
    handles.delete(paneId)
  },

  disposeMissing(livePaneIds: Set<string>): boolean {
    let removed = false
    for (const paneId of [...handles.keys()]) {
      if (!livePaneIds.has(paneId)) {
        terminalRegistry.dispose(paneId)
        removed = true
      }
    }
    return removed
  },
}
