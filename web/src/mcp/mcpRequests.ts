import { bridge } from '../bridge/bridge'
import { McpTool } from '../bridge/mcpMessages'
import type { HostMessageOf } from '../bridge/messages'
import { useAgentStore } from '../store/agentStore'
import { terminalRegistry } from '../terminal/terminalRegistry'
import { useBrowserStore } from '../store/browserStore'
import { isBrowserStarted } from '../browser/browserLayer'
import { argumentsOf } from './mcpArguments'
import { browserConsole, browserNetwork, browserScreenshot, navigateBrowserPane, openBrowserPane, reloadBrowserPane, resizeBrowserPane } from './mcpBrowser'
import { closeElement } from './mcpClose'
import { listCommands } from './mcpCommands'
import { layoutOf } from './mcpLayout'
import { focusElement, newTab, openWorkspace, renameElement, splitPane } from './mcpOrganize'
import { requireSession } from './mcpPanes'
import { readPane } from './mcpReadPane'
import { interruptPane, runCommand } from './mcpRun'
import { waitFor } from './mcpWaitFor'
import { createWorktree, listWorktrees, removeWorktree } from './mcpWorktrees'

type McpRequest = HostMessageOf<'mcp.request'>

const answer = async (request: McpRequest): Promise<unknown> => {
  switch (request.tool) {
    case McpTool.Layout:
      return layoutOf(requireSession(), useAgentStore.getState().agents, useBrowserStore.getState().states, request.pane, (paneId) => (terminalRegistry.get(paneId)?.started ?? false) || isBrowserStarted(paneId))
    case McpTool.ReadPane:
      return readPane(argumentsOf(request.arguments))
    case McpTool.Commands:
      return listCommands(argumentsOf(request.arguments))
    case McpTool.WaitFor:
      return waitFor(argumentsOf(request.arguments))
    case McpTool.OpenWorkspace:
      return openWorkspace(argumentsOf(request.arguments), request.pane)
    case McpTool.NewTab:
      return newTab(argumentsOf(request.arguments), request.pane)
    case McpTool.Split:
      return splitPane(argumentsOf(request.arguments), request.pane)
    case McpTool.Focus:
      return focusElement(argumentsOf(request.arguments))
    case McpTool.Rename:
      return renameElement(argumentsOf(request.arguments))
    case McpTool.Run:
      return runCommand(argumentsOf(request.arguments), request.pane)
    case McpTool.Interrupt:
      return interruptPane(argumentsOf(request.arguments), request.pane)
    case McpTool.Close:
      return closeElement(argumentsOf(request.arguments), request.pane)
    case McpTool.Worktrees:
      return listWorktrees(argumentsOf(request.arguments), request.pane)
    case McpTool.CreateWorktree:
      return createWorktree(argumentsOf(request.arguments), request.pane)
    case McpTool.RemoveWorktree:
      return removeWorktree(argumentsOf(request.arguments), request.pane)
    case McpTool.BrowserOpen:
      return openBrowserPane(argumentsOf(request.arguments), request.pane)
    case McpTool.BrowserNavigate:
      return navigateBrowserPane(argumentsOf(request.arguments), request.pane)
    case McpTool.BrowserReload:
      return reloadBrowserPane(argumentsOf(request.arguments), request.pane)
    case McpTool.BrowserResize:
      return resizeBrowserPane(argumentsOf(request.arguments), request.pane)
    case McpTool.BrowserConsole:
      return browserConsole(argumentsOf(request.arguments), request.pane)
    case McpTool.BrowserNetwork:
      return browserNetwork(argumentsOf(request.arguments), request.pane)
    case McpTool.BrowserScreenshot:
      return browserScreenshot(argumentsOf(request.arguments), request.pane)
    default:
      throw new Error(`Outil Tily inconnu : ${request.tool}. Mettez Tily à jour.`)
  }
}

export const receiveMcpRequest = async (request: McpRequest): Promise<void> => {
  try {
    bridge.send({ type: 'mcp.response', id: request.id, result: await answer(request) })
  } catch (error) {
    bridge.send({ type: 'mcp.response', id: request.id, error: error instanceof Error ? error.message : String(error) })
  }
}

export const installMcpServer = (): void => bridge.send({ type: 'mcp.install' })

export const removeMcpServer = (): void => bridge.send({ type: 'mcp.remove' })
