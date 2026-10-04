import { bridge } from '../bridge/bridge'
import type { HostMessageOf } from '../bridge/messages'
import { CANCELLED_REPLY, listenReplies, newAgentRequest } from '../bridge/requestListeners'
import { WorktreeBranchMode, WorktreeOperation, type Worktree } from '../bridge/worktreeMessages'
import { activePane, createOwnedWorkspace, DEFAULT_SHELL, panesOf, type Session } from '../model/session'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'
import { useWorktreeStore } from '../store/worktreeStore'
import { terminalRegistry } from '../terminal/terminalRegistry'
import { cancelWorktreeRemoval, requestWorktreeRemoval } from '../worktree/worktreeActions'
import { isWithinFolder, sameFolder } from '../worktree/worktreePaths'
import { flagArgument, textArgument, type McpArguments } from './mcpArguments'
import { agentLabel } from './mcpConsent'
import { requireCaller } from './mcpOrganize'
import { locationOf, placeOf, requireSession } from './mcpPanes'

const REPLY_TIMEOUT_MS = 15_000
const CONSENT_TIMEOUT_MS = 120_000
const OPERATION_TIMEOUT_MS = 590_000
const MAX_OUTPUT_CHARS = 4000
const BUSY = 'Une création ou une suppression de worktree est déjà en cours dans cette fenêtre de Tily : réessayez quand elle sera terminée.'

type Listed = HostMessageOf<'worktrees.listed'>
type Created = HostMessageOf<'worktrees.created'>
type Done = HostMessageOf<'worktrees.done'>
type Failed = HostMessageOf<'worktrees.failed'>

interface McpWorktreePane {
  pane: string
  location: string
}

interface McpOpenedWorktree {
  worktree: { path: string; name: string; branch: string }
  workspace: { id: string; name: string }
  tab: { id: string; name: string }
  pane: string
  shown: boolean
  install?: string
}

interface CreationRequest {
  repository: string
  branch: string
  mode: WorktreeBranchMode
  base?: string
  install: boolean
  database: boolean
  project: string
  folder?: string
}

const askHost = <T>(type: string, send: (request: number) => void): Promise<T> =>
  new Promise((resolve, reject) => {
    const request = newAgentRequest()
    const timer = setTimeout(() => {
      stop()
      reject(new Error('Tily n’a pas obtenu de réponse de Git à temps.'))
    }, REPLY_TIMEOUT_MS)
    const stop = listenReplies(request, (replyType, message) => {
      if (replyType === type) {
        clearTimeout(timer)
        stop()
        resolve(message as T)
      }
    })
    send(request)
  })

const failureOf = (failed: Failed): string => (failed.output ? `${failed.message}\n${failed.output.slice(-MAX_OUTPUT_CHARS)}` : failed.message)

const folderArgument = (values: McpArguments, name: string, caller: string | undefined): string => {
  const folder = textArgument(values, name) ?? placeOf(requireSession(), caller)?.pane.path
  if (!folder) {
    throw new Error('Indiquez le dossier du dépôt.')
  }
  return folder
}

const listOf = async (path: string): Promise<Listed> => {
  const listed = await askHost<Listed>('worktrees.listed', (request) => bridge.send({ type: 'worktrees.list', request, path }))
  if (listed.error || !listed.worktrees) {
    throw new Error(listed.error ?? 'Liste des worktrees indisponible.')
  }
  return listed
}

const closestWorktree = (path: string, worktrees: Worktree[]): Worktree | undefined =>
  worktrees.filter((worktree) => isWithinFolder(path, worktree.path)).sort((left, right) => right.path.length - left.path.length)[0]

const panesIn = (session: Session, worktree: Worktree, worktrees: Worktree[]): McpWorktreePane[] =>
  session.workspaces.flatMap((workspace) =>
    workspace.tabs.flatMap((tab) =>
      panesOf(tab.tree)
        .filter((pane) => closestWorktree(pane.path, worktrees) === worktree)
        .map((pane) => ({ pane: pane.id, location: locationOf({ workspace, tab }) })),
    ),
  )

export const listWorktrees = async (values: McpArguments, caller: string | undefined) => {
  const listed = await listOf(folderArgument(values, 'path', caller))
  const worktrees = listed.worktrees ?? []
  const session = requireSession()
  return { root: listed.root, worktrees: worktrees.map((worktree) => ({ ...worktree, panes: panesIn(session, worktree, worktrees) })) }
}

const modeOf = (value: string | undefined): WorktreeBranchMode => {
  const mode = value ?? WorktreeBranchMode.New
  if (!Object.values<string>(WorktreeBranchMode).includes(mode)) {
    throw new Error(`Mode inconnu : ${mode}. Utilisez new (nouvelle branche), local (branche locale) ou remote (branche distante).`)
  }
  return mode as WorktreeBranchMode
}

const openOwnedWorktree = (created: Created, owner: string, focus: boolean): McpOpenedWorktree => {
  const workspace = createOwnedWorkspace(created.name, created.path, DEFAULT_SHELL, owner)
  const tab = workspace.tabs[0]
  const pane = activePane(tab)
  if (created.install) {
    terminalRegistry.runAtStart(pane.id, created.install)
  }
  const shown = created.install !== undefined || focus
  useSessionStore.getState().change((draft) => {
    draft.workspaces.push(workspace)
    if (shown) {
      draft.active = workspace.id
    }
  })
  return {
    worktree: { path: created.path, name: created.name, branch: created.branch },
    workspace: { id: workspace.id, name: workspace.name },
    tab: { id: tab.id, name: tab.name },
    pane: pane.id,
    shown,
    install: created.install,
  }
}

const runCreation = (creation: CreationRequest, owner: string, focus: boolean): Promise<McpOpenedWorktree & { message: string; warnings: string[] }> =>
  new Promise((resolve, reject) => {
    const request = newAgentRequest()
    let opened: McpOpenedWorktree | undefined
    const timer = setTimeout(() => {
      stop()
      reject(new Error('La création du worktree n’a pas fini à temps : vérifiez son état dans Tily.'))
    }, OPERATION_TIMEOUT_MS)
    const stop = listenReplies(request, (type, message) => {
      if (type === 'worktrees.created') {
        opened = openOwnedWorktree(message as Created, owner, focus)
        return
      }
      if (type !== 'worktrees.done' && type !== 'worktrees.failed') {
        return
      }
      clearTimeout(timer)
      stop()
      if (type === 'worktrees.failed') {
        useWorktreeStore.getState().setBusy(null)
        useHostStore.getState().setStatus((message as Failed).message, StatusLevel.Error)
        reject(new Error(failureOf(message as Failed)))
      } else if (opened) {
        resolve({ ...opened, message: (message as Done).message, warnings: (message as Done).warnings })
      } else {
        reject(new Error('Le worktree a été créé, mais Tily n’a pas pu l’ouvrir.'))
      }
    })
    useWorktreeStore.getState().setBusy(WorktreeOperation.Create)
    useHostStore.getState().setStatus('Création d’un worktree demandée par Claude Code…')
    bridge.send({ type: 'worktrees.create', request, ...creation, remember: false, rememberFolder: false })
  })

export const createWorktree = async (values: McpArguments, caller: string | undefined) => {
  const owner = requireCaller(caller)
  const branch = textArgument(values, 'branch')
  if (!branch) {
    throw new Error('Indiquez la branche du worktree.')
  }
  const mode = modeOf(textArgument(values, 'mode'))
  const base = textArgument(values, 'base')
  const folder = textArgument(values, 'folder')
  if (useWorktreeStore.getState().busy) {
    throw new Error(BUSY)
  }
  const { sources } = await askHost<HostMessageOf<'worktrees.sourcesFound'>>('worktrees.sourcesFound', (request) =>
    bridge.send({ type: 'worktrees.sources', request, path: folderArgument(values, 'repository', caller) }),
  )
  const repository = sources.selected ?? sources.project
  const { plan } = await askHost<HostMessageOf<'worktrees.planned'>>('worktrees.planned', (request) =>
    bridge.send({ type: 'worktrees.plan', request, repository, branch, mode, base, project: sources.project, folder }),
  )
  if (plan.error || !plan.path) {
    throw new Error(plan.error ?? 'Tily n’a pas pu déterminer le dossier du worktree.')
  }
  if (useWorktreeStore.getState().busy) {
    throw new Error(BUSY)
  }
  const creation: CreationRequest = { repository, branch, mode, base, install: values.install !== false, database: values.database !== false, project: sources.project, folder }
  return runCreation(creation, owner, flagArgument(values, 'focus'))
}

const awaitRemoval = (worktree: Worktree, caller: string | undefined, values: McpArguments): Promise<{ path: string; message: string; warnings: string[] }> =>
  new Promise((resolve, reject) => {
    const request = newAgentRequest()
    let expired = false
    const answerTimer = setTimeout(() => {
      if (useWorktreeStore.getState().removal?.request === request) {
        expired = true
        cancelWorktreeRemoval()
      }
    }, CONSENT_TIMEOUT_MS)
    const operationTimer = setTimeout(() => {
      stop()
      reject(new Error('La suppression du worktree n’a pas fini à temps : vérifiez son état dans Tily.'))
    }, OPERATION_TIMEOUT_MS)
    const finish = (): void => {
      clearTimeout(answerTimer)
      clearTimeout(operationTimer)
      stop()
    }
    const stop = listenReplies(request, (type, message) => {
      if (type === CANCELLED_REPLY) {
        finish()
        reject(
          new Error(
            expired
              ? `Pas de réponse de l’utilisateur dans Tily en 2 minutes : le worktree ${worktree.path} n’a pas été supprimé.`
              : `L’utilisateur a refusé dans Tily la suppression du worktree ${worktree.path}. Ne réessayez pas sans le lui demander.`,
          ),
        )
      } else if (type === 'worktrees.done') {
        finish()
        resolve({ path: worktree.path, message: (message as Done).message, warnings: (message as Done).warnings })
      } else if (type === 'worktrees.failed') {
        finish()
        reject(new Error(failureOf(message as Failed)))
      }
    })
    const agent = agentLabel(caller)
    requestWorktreeRemoval(worktree.path, worktree.branch, { request, requestedBy: agent, keepBranch: flagArgument(values, 'keepBranch'), dropDatabase: values.dropDatabase !== false })
    bridge.send({ type: 'attention.flash' })
    useHostStore.getState().setStatus(`${agent} demande la suppression d’un worktree.`, StatusLevel.Warning)
  })

export const removeWorktree = async (values: McpArguments, caller: string | undefined) => {
  const path = textArgument(values, 'path')
  if (!path) {
    throw new Error('Indiquez le dossier du worktree.')
  }
  const worktree = (await listOf(path)).worktrees?.find((candidate) => sameFolder(candidate.path, path))
  if (!worktree) {
    throw new Error(`${path} n’est pas un worktree : les worktrees d’un dépôt sont donnés par tily_worktrees.`)
  }
  if (worktree.isMain) {
    throw new Error(`Refus : ${worktree.path} est le dépôt principal, il ne se supprime pas.`)
  }
  const callerPlace = placeOf(requireSession(), caller)
  if (callerPlace && isWithinFolder(callerPlace.pane.path, worktree.path)) {
    throw new Error('Votre pane est dans ce worktree : Claude Code ne peut pas supprimer le dossier dans lequel il tourne.')
  }
  const { removal, busy } = useWorktreeStore.getState()
  if (removal || busy) {
    throw new Error(BUSY)
  }
  return awaitRemoval(worktree, caller, values)
}
