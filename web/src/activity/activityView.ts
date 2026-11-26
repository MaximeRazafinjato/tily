import { ProcessCategory, type PaneUsage, type ProcessUsage } from '../bridge/activityMessages'
import { panesOf, type Session } from '../model/session'

export interface Usage {
  cpu: number
  ram: number
  count: number
}

export interface TabUsage {
  id: string
  label: string
  color: string | undefined
  usage: Usage
  processes: ProcessUsage[]
}

export const HOST_ROW_ID = 'host'
export const CATEGORY_LABELS: Record<ProcessCategory, string> = {
  [ProcessCategory.Claude]: 'Claude',
  [ProcessCategory.Commands]: 'Claude',
  [ProcessCategory.Mcp]: 'Serveurs MCP',
  [ProcessCategory.Terminal]: 'Terminal',
  [ProcessCategory.App]: 'Application',
  [ProcessCategory.WebView]: 'Moteur WebView2',
  [ProcessCategory.Interface]: 'Interface',
  [ProcessCategory.BrowserPages]: 'Pages des panes navigateur',
  [ProcessCategory.Other]: 'Autres',
}
export const PANE_CATEGORIES = [ProcessCategory.Claude, ProcessCategory.Mcp, ProcessCategory.Terminal]
export const HOST_CATEGORIES = [ProcessCategory.App, ProcessCategory.Interface, ProcessCategory.BrowserPages, ProcessCategory.WebView, ProcessCategory.Other]

const MEGABYTES_PER_GIGABYTE = 1024
const MAX_PROCESS_NAMES = 5
const EXECUTABLE_SUFFIX = /.exe$/i

const displayedCategory = (category: ProcessCategory): ProcessCategory => (category === ProcessCategory.Commands ? ProcessCategory.Claude : category)

export const usageOf = (processes: ProcessUsage[]): Usage => ({
  cpu: processes.reduce((sum, process) => sum + process.cpu, 0),
  ram: processes.reduce((sum, process) => sum + process.ram, 0),
  count: processes.length,
})

export const formatRam = (megabytes: number): string => (megabytes >= MEGABYTES_PER_GIGABYTE ? `${(megabytes / MEGABYTES_PER_GIGABYTE).toFixed(1)} Go` : `${Math.round(megabytes)} Mo`)

export const formatUsage = (usage: Pick<Usage, 'cpu' | 'ram'>): string => `${Math.round(usage.cpu)} % · ${formatRam(usage.ram)}`

export const ramShare = (usage: Usage, total: Usage): number => (total.ram > 0 ? Math.round((usage.ram / total.ram) * 100) : 0)

export const tabUsages = (session: Session, panes: PaneUsage[]): TabUsage[] => {
  const byPane = new Map(panes.map((pane) => [pane.paneId, pane.processes]))
  return session.workspaces.flatMap((workspace) =>
    workspace.tabs.flatMap((tab) => {
      const processes = panesOf(tab.tree).flatMap((pane) => byPane.get(pane.id) ?? [])
      return processes.length === 0 ? [] : [{ id: tab.id, label: `${workspace.name} › ${tab.name}`, color: tab.color ?? workspace.color, usage: usageOf(processes), processes }]
    }),
  )
}

export interface NamedUsage {
  name: string
  usage: Usage
}

export interface CategoryUsage {
  category: ProcessCategory
  usage: Usage
  names: NamedUsage[]
}

const byName = (processes: ProcessUsage[]): NamedUsage[] => {
  const groups = new Map<string, ProcessUsage[]>()
  for (const process of processes) {
    const name = process.name.replace(EXECUTABLE_SUFFIX, '')
    groups.set(name, [...(groups.get(name) ?? []), process])
  }
  const names = [...groups].map(([name, members]) => ({ name, usage: usageOf(members) })).sort((left, right) => right.usage.ram - left.usage.ram)
  return names.length > 1 ? names.slice(0, MAX_PROCESS_NAMES) : []
}

export const byCategory = (processes: ProcessUsage[], categories: ProcessCategory[]): CategoryUsage[] =>
  categories.flatMap((category) => {
    const members = processes.filter((process) => displayedCategory(process.category) === category)
    return members.length > 0 ? [{ category, usage: usageOf(members), names: byName(members) }] : []
  })
