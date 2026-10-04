import { bridge } from '../bridge/bridge'
import type { BrowserWebMessage } from '../bridge/browserMessages'
import { listenReplies, newAgentRequest } from '../bridge/requestListeners'

const DEFAULT_TIMEOUT_MS = 10_000
const NO_ANSWER = 'Le navigateur de Tily n’a pas répondu à temps.'

type WithoutRequest<T> = T extends unknown ? Omit<T, 'request'> : never

export type BrowserRequest = WithoutRequest<BrowserWebMessage>

interface BrowserReply {
  result?: unknown
  error?: string
}

export const requestBrowser = <T>(message: BrowserRequest, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const request = newAgentRequest()
    const stop = listenReplies(request, (_type, reply) => {
      clearTimeout(timer)
      stop()
      const { result, error } = reply as BrowserReply
      if (error) {
        reject(new Error(error))
      } else {
        resolve(result as T)
      }
    })
    const timer = setTimeout(() => {
      stop()
      reject(new Error(NO_ANSWER))
    }, timeoutMs)
    bridge.send({ ...message, request } as BrowserWebMessage)
  })
