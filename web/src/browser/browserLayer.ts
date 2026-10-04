import { bridge } from '../bridge/bridge'
import { DIRECT_LETTER_KEYS } from '../keyboard/commands'
import { BLANK_PAGE, BrowserViewport } from '../model/browser'
import { activeTab, activeWorkspace, findPane } from '../model/session'
import { useBrowserStore } from '../store/browserStore'
import { useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { requestBrowser } from './browserRequests'

const BODY_SELECTOR = '[data-browser-body]'
const MODAL_SELECTOR = '[role="menu"], [role="dialog"], [role="alertdialog"]'
const FLOATING_SELECTOR = '[role="tooltip"]'
const SAMPLES_PER_SIDE = 4
const SNAPSHOT_RELEASE_MS = 150
const SHORTCUT_LETTERS = Object.keys(DIRECT_LETTER_KEYS).join('')

interface BrowserSlot {
  covered: boolean
  hidden: boolean
  generation: number
  sent: string
}

interface Snapshot {
  image: string
}

const slots = new Map<string, BrowserSlot>()

const intersects = (a: DOMRect, b: DOMRect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

const sampledCover = (body: Element, rect: DOMRect): boolean => {
  for (let column = 0; column < SAMPLES_PER_SIDE; column++) {
    for (let row = 0; row < SAMPLES_PER_SIDE; row++) {
      const top = document.elementFromPoint(rect.left + (rect.width * (column + 0.5)) / SAMPLES_PER_SIDE, rect.top + (rect.height * (row + 0.5)) / SAMPLES_PER_SIDE)
      if (top && !body.contains(top)) {
        return true
      }
    }
  }
  return false
}

const isCovered = (body: Element, rect: DOMRect, modal: boolean): boolean =>
  modal || Array.from(document.querySelectorAll(FLOATING_SELECTOR)).some((element) => intersects(element.getBoundingClientRect(), rect)) || sampledCover(body, rect)

const attach = (paneId: string): void => {
  const session = useSessionStore.getState().session
  const pane = session ? findPane(session, paneId) : undefined
  bridge.send({ type: 'browser.attach', pane: paneId, url: pane?.url ?? BLANK_PAGE, viewport: pane?.viewport ?? BrowserViewport.Desktop, shortcuts: SHORTCUT_LETTERS })
}

const slotOf = (paneId: string): BrowserSlot => {
  const existing = slots.get(paneId)
  if (existing) {
    return existing
  }
  const slot: BrowserSlot = { covered: false, hidden: false, generation: 0, sent: '' }
  slots.set(paneId, slot)
  attach(paneId)
  return slot
}

const sendBounds = (paneId: string, slot: BrowserSlot, rect: DOMRect | null, visible: boolean): void => {
  const x = Math.round(rect?.left ?? 0)
  const y = Math.round(rect?.top ?? 0)
  const width = Math.round(rect?.width ?? 0)
  const height = Math.round(rect?.height ?? 0)
  const key = visible ? `${x},${y},${width},${height}` : 'hidden'
  if (key !== slot.sent) {
    slot.sent = key
    bridge.send({ type: 'browser.bounds', pane: paneId, x, y, width, height, visible })
  }
}

const cover = (paneId: string, slot: BrowserSlot): void => {
  slot.covered = true
  const generation = ++slot.generation
  requestBrowser<Snapshot>({ type: 'browser.snapshot', pane: paneId })
    .then(({ image }) => {
      if (slot.covered && slot.generation === generation) {
        if (image) {
          useBrowserStore.getState().setSnapshot(paneId, image)
        } else {
          slot.hidden = true
        }
      }
    })
    .catch(() => {
      if (slot.covered && slot.generation === generation) {
        slot.hidden = true
      }
    })
}

const uncover = (paneId: string, slot: BrowserSlot): void => {
  slot.covered = false
  slot.hidden = false
  const generation = ++slot.generation
  setTimeout(() => {
    if (!slot.covered && slot.generation === generation) {
      useBrowserStore.getState().clearSnapshot(paneId)
    }
  }, SNAPSHOT_RELEASE_MS)
}

const frame = (): void => {
  const modal = document.querySelector(MODAL_SELECTOR) !== null
  const seen = new Set<string>()
  for (const body of document.querySelectorAll<HTMLElement>(BODY_SELECTOR)) {
    const paneId = body.dataset.browserBody
    if (!paneId) {
      continue
    }
    seen.add(paneId)
    const slot = slotOf(paneId)
    const rect = body.getBoundingClientRect()
    const displayed = rect.width > 0 && rect.height > 0
    const covered = displayed && isCovered(body, rect, modal)
    if (covered && !slot.covered) {
      cover(paneId, slot)
    } else if (!covered && slot.covered) {
      uncover(paneId, slot)
    }
    sendBounds(paneId, slot, rect, displayed && !slot.hidden)
  }
  for (const [paneId, slot] of slots) {
    if (!seen.has(paneId)) {
      sendBounds(paneId, slot, null, false)
    }
  }
}

export const snapshotShown = (paneId: string): void => {
  const slot = slots.get(paneId)
  if (slot?.covered) {
    slot.hidden = true
  }
}

export const isBrowserShown = (paneId: string): boolean => {
  const slot = slots.get(paneId)
  return Boolean(slot && !slot.covered && slot.sent !== 'hidden' && slot.sent !== '')
}

export const isBrowserStarted = (paneId: string): boolean => slots.has(paneId)

export const focusBrowser = (paneId: string): void => {
  if (slots.has(paneId)) {
    bridge.send({ type: 'browser.focus', pane: paneId })
  }
}

const activeBrowserPaneId = (): string | undefined => {
  const session = useSessionStore.getState().session
  const workspace = session ? activeWorkspace(session) : undefined
  const paneId = workspace ? activeTab(workspace).active : undefined
  return paneId && slots.has(paneId) ? paneId : undefined
}

export const restoreBrowserFocus = (): void => {
  requestAnimationFrame(() => {
    const paneId = activeBrowserPaneId()
    const idle = !document.activeElement || document.activeElement === document.body
    if (paneId && idle && !useHostStore.getState().leaderActive && document.querySelector(MODAL_SELECTOR) === null) {
      focusBrowser(paneId)
    }
  })
}

export const disposeMissingBrowsers = (livePaneIds: Set<string>): void => {
  for (const paneId of slots.keys()) {
    if (!livePaneIds.has(paneId)) {
      slots.delete(paneId)
      bridge.send({ type: 'browser.close', pane: paneId })
      useBrowserStore.getState().forget(paneId)
    }
  }
}

export const startBrowserLayer = (): (() => void) => {
  let handle = 0
  const loop = () => {
    frame()
    handle = requestAnimationFrame(loop)
  }
  handle = requestAnimationFrame(loop)
  const stopLeader = useHostStore.subscribe((state, previous) => {
    if (previous.leaderActive && !state.leaderActive) {
      restoreBrowserFocus()
    }
  })
  return () => {
    cancelAnimationFrame(handle)
    stopLeader()
  }
}
