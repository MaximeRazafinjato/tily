import { bridge } from '../bridge/bridge'
import { allPanes, panesOf, type Pane, type Session } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { isDetachedWindow } from '../store/windowStore'
import { RestoreKind, terminalRegistry } from './terminalRegistry'

const IDLE_TIMEOUT_MS = 1000

const closedText = new Map<string, string>()
let pendingText: Record<string, string> = {}
let resendClosedText = false
let gradualSaveRunning = false

const closedPanes = (session: Session): Pane[] => session.closed.flatMap((closed) => panesOf(closed.tab.tree))

const nextIdleSlice = (): Promise<void> => new Promise((resolve) => requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT_MS }))

const collectSnapshot = (paneId: string): void => {
  const snapshot = terminalRegistry.takeSnapshot(paneId)
  if (snapshot !== undefined) {
    pendingText[paneId] = snapshot
  }
}

const sendTextSave = (): void => {
  const { session } = useSessionStore.getState()
  if (!session || isDetachedWindow()) {
    return
  }
  const keep = [...allPanes(session), ...closedPanes(session)].map((pane) => pane.id)
  const kept = new Set(keep)
  for (const paneId of closedText.keys()) {
    if (!kept.has(paneId)) {
      closedText.delete(paneId)
    }
  }
  const resent = resendClosedText ? Object.fromEntries(closedText) : {}
  const text = Object.fromEntries(Object.entries({ ...resent, ...terminalRegistry.unsavedPrimedText(), ...pendingText }).filter(([paneId]) => kept.has(paneId)))
  pendingText = {}
  resendClosedText = false
  bridge.send({ type: 'text.save', text, keep })
}

export const primeSessionText = (session: Session, text: Record<string, string>): void => {
  for (const pane of allPanes(session)) {
    const content = text[pane.id]
    if (content) {
      terminalRegistry.prime(pane.id, content, RestoreKind.Session)
    }
  }
  for (const pane of closedPanes(session)) {
    const content = text[pane.id]
    if (content) {
      closedText.set(pane.id, content)
    }
  }
}

export const keepClosedTabText = (text: Record<string, string>): void => {
  for (const [paneId, content] of Object.entries(text)) {
    closedText.set(paneId, content)
  }
  Object.assign(pendingText, text)
  sendTextSave()
}

export const takeClosedTabText = (paneIds: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(paneIds).flatMap(([closedPaneId, paneId]) => {
    const content = closedText.get(closedPaneId)
    return content === undefined ? [] : [[paneId, content]]
  }))

export const forgetRemovedText = (): void => sendTextSave()

export const markTextSaveFailed = (): void => {
  terminalRegistry.markAllDirty()
  resendClosedText = true
}

const saveTextNow = (): void => {
  terminalRegistry.dirtyPaneIds().forEach(collectSnapshot)
  sendTextSave()
}

const saveTextGradually = async (): Promise<void> => {
  if (gradualSaveRunning) {
    return
  }
  gradualSaveRunning = true
  try {
    for (const paneId of terminalRegistry.dirtyPaneIds()) {
      do {
        await nextIdleSlice()
      } while (terminalRegistry.cacheStableText(paneId))
      collectSnapshot(paneId)
      sendTextSave()
    }
    if (resendClosedText) {
      sendTextSave()
    }
  } finally {
    gradualSaveRunning = false
  }
}

export const startTextAutosave = (intervalSeconds: number): (() => void) => {
  const timer = setInterval(() => void saveTextGradually(), intervalSeconds * 1000)
  return () => clearInterval(timer)
}

export const closeApplication = (): void => {
  const { session } = useSessionStore.getState()
  if (session && !isDetachedWindow()) {
    bridge.send({ type: 'session.save', session })
  }
  saveTextNow()
  bridge.send({ type: 'window.close' })
}
