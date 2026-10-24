import { panesOf } from '../model/session'
import { commandTracking } from '../terminal/commandOutput'
import { queryActivity } from '../terminal/paneActivity'
import { closePaneWithoutAsking, closeTabWithoutAsking } from '../terminal/tabLifecycle'
import { terminalRegistry } from '../terminal/terminalRegistry'
import { textArgument, type McpArguments } from './mcpArguments'
import { paneLabel, requireConsent } from './mcpConsent'
import { locationOf, placeOf, requirePlace, requireSession, requireTab } from './mcpPanes'
import { restoreHint } from '../keyboard/shortcutLabels'

const OWN_PANE = 'Vous ne pouvez pas fermer votre propre pane ni son onglet : Claude Code s’y exécute.'

enum ClosedKind {
  Pane = 'pane',
  Tab = 'tab',
}

interface McpClosed {
  kind: ClosedKind
  id: string
  asked: boolean
  message: string
}

const busyLines = async (paneIds: string[]): Promise<string[]> => {
  const started = paneIds.filter((paneId) => terminalRegistry.get(paneId)?.started)
  const commands = started.flatMap((paneId) => {
    const handle = terminalRegistry.get(paneId)
    const running = handle ? commandTracking(handle.terminal).running : null
    return running?.command ? [running.command] : []
  })
  const programs = [...new Set((await queryActivity(started)).flatMap((activity) => activity.processes))]
  return [...commands.map((command) => `Commande en cours : ${command}`), ...(programs.length > 0 ? [`Programmes en cours : ${programs.join(', ')}`] : [])]
}

const closePane = async (paneId: string, caller: string | undefined): Promise<McpClosed> => {
  const place = requirePlace(paneId)
  if (paneId === caller) {
    throw new Error(OWN_PANE)
  }
  const busy = await busyLines([paneId])
  const asked = !caller || place.pane.owner !== caller || busy.length > 0
  if (asked) {
    await requireConsent({ caller, action: 'Fermer le pane et arrêter ses programmes', target: paneLabel(place), detail: busy.join('\n') || undefined })
  }
  if (!placeOf(requireSession(), paneId)) {
    return { kind: ClosedKind.Pane, id: paneId, asked, message: 'Le pane était déjà fermé.' }
  }
  closePaneWithoutAsking(paneId)
  return { kind: ClosedKind.Pane, id: paneId, asked, message: `Pane de « ${locationOf(place)} » fermé.` }
}

const closeTab = async (tabId: string, caller: string | undefined): Promise<McpClosed> => {
  const { workspace, tab } = requireTab(tabId)
  const panes = panesOf(tab.tree)
  if (caller && panes.some((pane) => pane.id === caller)) {
    throw new Error(OWN_PANE)
  }
  const busy = await busyLines(panes.map((pane) => pane.id))
  const owned = Boolean(caller) && tab.owner === caller && panes.every((pane) => pane.owner === caller)
  const asked = !owned || busy.length > 0
  if (asked) {
    const count = panes.length === 1 ? '1 pane' : `${panes.length} panes`
    await requireConsent({
      caller,
      action: 'Fermer l’onglet et arrêter ses programmes',
      target: `onglet « ${workspace.name} › ${tab.name} » · ${count} (${tab.owner ? 'créé par Claude' : 'ouvert par vous'})`,
      detail: busy.join('\n') || undefined,
    })
  }
  const still = requireSession().workspaces.some((candidate) => candidate.tabs.some((current) => current.id === tabId))
  if (!still) {
    return { kind: ClosedKind.Tab, id: tabId, asked, message: 'L’onglet était déjà fermé.' }
  }
  closeTabWithoutAsking(tabId)
  return { kind: ClosedKind.Tab, id: tabId, asked, message: `Onglet « ${workspace.name} › ${tab.name} » fermé ; l’utilisateur peut le rouvrir par ${restoreHint()}.` }
}

export const closeElement = async (values: McpArguments, caller: string | undefined): Promise<McpClosed> => {
  const paneId = textArgument(values, 'pane')
  const tabId = textArgument(values, 'tab')
  if (Boolean(paneId) === Boolean(tabId)) {
    throw new Error('Indiquez un seul élément à fermer : pane ou tab.')
  }
  return paneId ? closePane(paneId, caller) : closeTab(tabId as string, caller)
}
