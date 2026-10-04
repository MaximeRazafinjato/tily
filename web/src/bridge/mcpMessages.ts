export enum McpTool {
  Layout = 'layout',
  ReadPane = 'readPane',
  Commands = 'commands',
  WaitFor = 'waitFor',
  OpenWorkspace = 'openWorkspace',
  NewTab = 'newTab',
  Split = 'split',
  Focus = 'focus',
  Rename = 'rename',
  Run = 'run',
  Interrupt = 'interrupt',
  Close = 'close',
  Worktrees = 'worktrees',
  CreateWorktree = 'createWorktree',
  RemoveWorktree = 'removeWorktree',
  BrowserOpen = 'browserOpen',
  BrowserNavigate = 'browserNavigate',
  BrowserReload = 'browserReload',
  BrowserResize = 'browserResize',
  BrowserConsole = 'browserConsole',
  BrowserNetwork = 'browserNetwork',
  BrowserScreenshot = 'browserScreenshot',
}

export interface McpServerInfo {
  configFile: string
  executable: string
  available: boolean
  installed: boolean
  command?: string
  listening: boolean
  error?: string
}

export type McpHostMessage = { type: 'mcp.request'; id: string; tool: string; pane?: string; arguments?: unknown }

export type McpWebMessage = { type: 'mcp.install' } | { type: 'mcp.remove' } | { type: 'mcp.response'; id: string; result?: unknown; error?: string }
