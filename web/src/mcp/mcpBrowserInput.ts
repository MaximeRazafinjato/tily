import type { BrowserTarget } from '../bridge/browserMessages'
import { requestBrowser } from '../browser/browserRequests'
import { flagArgument, numberArgument, textArgument, type McpArguments } from './mcpArguments'
import { describe, startedBrowser } from './mcpBrowser'

const INPUT_TIMEOUT_MS = 45_000

const targetArgument = (values: McpArguments): BrowserTarget | undefined => {
  const value = values.target
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as BrowserTarget) : undefined
}

const amountArgument = (values: McpArguments): number | undefined => (typeof values.amount === 'number' && Number.isFinite(values.amount) ? values.amount : undefined)

export const browserSnapshot = async (values: McpArguments, caller: string | undefined) => {
  const place = await startedBrowser(values, caller)
  return { ...describe(place), ...(await requestBrowser<object>({ type: 'browser.elements', pane: place.pane.id, scope: textArgument(values, 'scope') }, INPUT_TIMEOUT_MS)) }
}

export const browserClick = async (values: McpArguments, caller: string | undefined) => {
  const place = await startedBrowser(values, caller)
  const target = targetArgument(values)
  if (!target) {
    throw new Error('Indiquez l’élément visé : ref, selector, label, ou x et y.')
  }
  return { ...describe(place), ...(await requestBrowser<object>({ type: 'browser.click', pane: place.pane.id, target, doubleClick: flagArgument(values, 'doubleClick') }, INPUT_TIMEOUT_MS)) }
}

export const browserType = async (values: McpArguments, caller: string | undefined) => {
  const place = await startedBrowser(values, caller)
  const text = typeof values.text === 'string' ? values.text : ''
  return {
    ...describe(place),
    ...(await requestBrowser<object>({ type: 'browser.type', pane: place.pane.id, target: targetArgument(values), text, clear: flagArgument(values, 'clear'), submit: flagArgument(values, 'submit') }, INPUT_TIMEOUT_MS)),
  }
}

export const browserPress = async (values: McpArguments, caller: string | undefined) => {
  const place = await startedBrowser(values, caller)
  const keys = textArgument(values, 'keys')
  if (!keys) {
    throw new Error('Indiquez la touche à presser, par exemple Enter, Escape, Tab ou Ctrl+A.')
  }
  return { ...describe(place), ...(await requestBrowser<object>({ type: 'browser.press', pane: place.pane.id, target: targetArgument(values), keys, repeat: numberArgument(values, 'repeat') ?? 1 }, INPUT_TIMEOUT_MS)) }
}

export const browserScroll = async (values: McpArguments, caller: string | undefined) => {
  const place = await startedBrowser(values, caller)
  return {
    ...describe(place),
    ...(await requestBrowser<object>({ type: 'browser.scroll', pane: place.pane.id, target: targetArgument(values), direction: textArgument(values, 'direction'), amount: amountArgument(values) }, INPUT_TIMEOUT_MS)),
  }
}

export const browserEvaluate = async (values: McpArguments, caller: string | undefined) => {
  const place = await startedBrowser(values, caller)
  const expression = textArgument(values, 'expression')
  if (!expression) {
    throw new Error('Indiquez l’expression JavaScript à évaluer dans la page.')
  }
  return { ...describe(place), ...(await requestBrowser<object>({ type: 'browser.evaluate', pane: place.pane.id, expression }, INPUT_TIMEOUT_MS)) }
}
