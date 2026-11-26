export enum ProcessCategory {
  Claude = 'claude',
  Commands = 'commands',
  Mcp = 'mcp',
  Terminal = 'terminal',
  App = 'app',
  WebView = 'webview',
  Interface = 'interface',
  BrowserPages = 'pages',
  Other = 'other',
}

export interface ProcessUsage {
  id: number
  name: string
  depth: number
  category: ProcessCategory
  cpu: number
  ram: number
}

export interface PaneUsage {
  paneId: string
  processes: ProcessUsage[]
}

export type ActivityHostMessage = { type: 'activity.state'; panes: PaneUsage[]; host: ProcessUsage[] }

export type ActivityWebMessage = { type: 'activity.subscribe' } | { type: 'activity.unsubscribe' }
