import type { BrowserViewport } from '../model/browser'

export enum BrowserLogLevel {
  Debug = 'debug',
  Log = 'log',
  Warn = 'warn',
  Error = 'error',
}

export interface BrowserState {
  pane: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  errors: number
  viewport: BrowserViewport
}

export interface BrowserKey {
  key: string
  code: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export interface BrowserNavigation {
  url: string
  title: string
  success: boolean
  status?: number
  error?: string
  errors: number
}

export interface BrowserConsoleEntry {
  sequence: number
  at: string
  level: BrowserLogLevel
  text: string
  url?: string
  line?: number
  load: number
}

export interface BrowserNetworkEntry {
  sequence: number
  at: string
  method: string
  url: string
  type?: string
  status?: number
  statusText?: string
  mimeType?: string
  durationMs?: number
  failed: boolean
  error?: string
  body?: string
  load: number
}

export interface BrowserEntries<T> {
  entries: T[]
  matching: number
  load: number
}

export interface BrowserCapture {
  png: string
  width: number
  height: number
  scale: number
  viewport: BrowserViewport
  url: string
  title: string
}

export type BrowserHostMessage =
  | { type: 'browser.state'; state: BrowserState }
  | { type: 'browser.newPane'; pane: string; url: string }
  | { type: 'browser.focused'; pane: string }
  | { type: 'browser.key'; pane: string; key: BrowserKey }
  | { type: 'browser.failed'; pane: string; message: string }
  | { type: 'browser.reply'; request: number; result?: unknown; error?: string }

export type BrowserWebMessage =
  | { type: 'browser.attach'; pane: string; url: string; viewport: BrowserViewport; shortcuts: string }
  | { type: 'browser.bounds'; pane: string; x: number; y: number; width: number; height: number; visible: boolean }
  | { type: 'browser.snapshot'; pane: string; request: number }
  | { type: 'browser.navigate'; pane: string; url: string; request?: number }
  | { type: 'browser.back'; pane: string }
  | { type: 'browser.reload'; pane: string; request?: number }
  | { type: 'browser.viewport'; pane: string; viewport: BrowserViewport; request?: number }
  | { type: 'browser.devtools'; pane: string }
  | { type: 'browser.focus'; pane: string }
  | { type: 'browser.close'; pane: string }
  | { type: 'browser.console'; pane: string; request: number; level: BrowserLogLevel; sinceLoad: boolean; limit: number }
  | { type: 'browser.network'; pane: string; request: number; failedOnly: boolean; sinceLoad: boolean; limit: number }
  | { type: 'browser.screenshot'; pane: string; request: number; viewport: BrowserViewport; fullPage: boolean }
