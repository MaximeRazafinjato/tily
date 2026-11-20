import { commandTracking, finishedCommandOutput, OutputFailure, type FinishedCommand } from '../terminal/commandOutput'
import { capText, lastLines } from '../terminal/terminalText'
import { flagArgument, numberArgument, textArgument, type McpArguments } from './mcpArguments'
import { localIsoTime } from './mcpTime'
import { locationOf, requireSession, requireStartedPane, startedPanes, type McpPaneTarget } from './mcpPanes'

const DEFAULT_LIMIT = 20
const EXCERPT_LINES = 20
const EXCERPT_CHARS = 2000
const LINE_BREAK = '\n'
const UNTRACKED_NOTE =
  'Les panes « untracked » ne signalent pas leurs commandes à Tily (seuls Windows PowerShell et PowerShell 7 le font) : leur succès est inconnu, lisez leur sortie avec tily_read_pane.'

export interface McpCommand {
  id: number
  pane: string
  location: string
  command: string
  cwd: string
  success: boolean
  durationMs: number
  finishedAt: string
  output?: string
  outputLines?: number
  outputTrimmed?: true
}

interface McpRunningCommand {
  pane: string
  location: string
  command: string
  cwd: string
  startedAt: string
}

interface McpUntrackedPane {
  pane: string
  location: string
  shell: string
}

interface McpCommandList {
  commands: McpCommand[]
  running: McpRunningCommand[]
  untracked?: McpUntrackedPane[]
  note?: string
}

const withExcerpt = (target: McpPaneTarget, described: McpCommand): McpCommand => {
  const output = finishedCommandOutput(target.handle.terminal, described.id)
  if ('text' in output) {
    return { ...described, output: capText(lastLines(output.text, EXCERPT_LINES), EXCERPT_CHARS).text, outputLines: output.text.split(LINE_BREAK).length }
  }
  return output.failure === OutputFailure.Empty ? { ...described, output: '', outputLines: 0 } : { ...described, outputTrimmed: true }
}

export const describeCommand = (target: McpPaneTarget, command: FinishedCommand, excerpt: boolean): McpCommand => {
  const described: McpCommand = {
    id: command.id,
    pane: target.pane.id,
    location: locationOf(target),
    command: command.command,
    cwd: command.cwd,
    success: command.success,
    durationMs: command.durationMs,
    finishedAt: localIsoTime(command.finishedAt),
  }
  return excerpt ? withExcerpt(target, described) : described
}

export const listCommands = (values: McpArguments): McpCommandList => {
  const paneId = textArgument(values, 'pane')
  const failedOnly = flagArgument(values, 'failedOnly')
  const limit = numberArgument(values, 'limit') ?? DEFAULT_LIMIT
  const tracked = (paneId ? [requireStartedPane(paneId)] : startedPanes(requireSession())).map((target) => ({ target, tracking: commandTracking(target.handle.terminal) }))
  const commands = tracked
    .flatMap(({ target, tracking }) => tracking.finished.filter((command) => !failedOnly || !command.success).map((command) => ({ target, command })))
    .sort((left, right) => right.command.finishedAt - left.command.finishedAt)
    .slice(0, limit)
    .map(({ target, command }) => describeCommand(target, command, true))
  const running = tracked.flatMap(({ target, tracking }) =>
    tracking.running && tracking.running.command !== ''
      ? [{ pane: target.pane.id, location: locationOf(target), command: tracking.running.command, cwd: tracking.running.cwd, startedAt: localIsoTime(tracking.running.startedAt) }]
      : [],
  )
  const untracked = tracked.filter(({ tracking }) => !tracking.integrated).map(({ target }) => ({ pane: target.pane.id, location: locationOf(target), shell: target.pane.shell }))
  return untracked.length > 0 ? { commands, running, untracked, note: UNTRACKED_NOTE } : { commands, running }
}
