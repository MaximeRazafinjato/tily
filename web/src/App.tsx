import { useEffect } from 'react'
import { clearSeenCommandNotices } from './terminal/commandNotices'
import { startAttentionNotifier } from './agents/attentionNotifier'
import { bridge } from './bridge/bridge'
import { receiveBrowserFailure, receiveBrowserFocused, receiveBrowserState, receiveNewBrowserPane } from './browser/browserActions'
import { receiveBrowserKey } from './browser/browserKeys'
import { disposeMissingBrowsers, startBrowserLayer } from './browser/browserLayer'
import { dispatchReply } from './bridge/requestListeners'
import { WorktreeOperation } from './bridge/worktreeMessages'
import { AppShell } from './components/AppShell'
import { receiveMcpRequest } from './mcp/mcpRequests'
import { allPanes, restoredSessionLabel } from './model/session'
import { useAgentStore } from './store/agentStore'
import { StatusLevel, useHostStore } from './store/hostStore'
import { usePaneStore } from './store/paneStore'
import { useSessionStore } from './store/sessionStore'
import { useUiStore } from './store/uiStore'
import { receiveActivity, receiveApplicationClosing } from './terminal/closeGuard'
import { receiveQueriedActivity } from './terminal/paneActivity'
import { queryContext, receiveContext } from './terminal/contextActions'
import { startExternalDrops } from './terminal/externalDrop'
import { receiveCreated, receiveDeleted, receiveGitMarks, receiveListing, receiveRenamed } from './explorer/fileExplorerActions'
import { receiveProjectFiles } from './explorer/projectFileActions'
import { receivePreview, receivePreviewRequest, startDeferredPreviews } from './preview/previewActions'
import { receivePreviewSaved, receivePreviewSaveFailed } from './preview/previewEdit'
import { receiveGitAutoFetchEnded, receiveGitAutoFetchStarted, receiveGitChanged, receiveGitDetails, receiveGitDiff, receiveGitDone, receiveGitFailed, receiveGitHistory, receiveGitPushRejected, receiveGitState } from './git/gitReceivers'
import { insertIntoPane, joinPane } from './terminal/terminalActions'
import { WORKTREE_FOLDER_FIELD, WORKTREE_REPOSITORY_FIELD } from './worktree/worktreeActions'
import { PROJECT_REPOSITORY_FIELD, receiveProjectRepositories, receiveProjectRepositoryPicked, receiveProjectRepositoryRemembered } from './project/projectOpenActions'
import { receiveWorktreeCreated, receiveWorktreeDone, receiveWorktreeFailed, receiveWorktreePlan, receiveWorktreeProgress, receiveWorktreeFolderPicked, receiveWorktreeRepositoryPicked, receiveWorktreeSources } from './worktree/worktreeReceivers'
import { terminalRegistry } from './terminal/terminalRegistry'
import { receiveRestartRequest, receiveUpdateNotice, receiveUpdateRestart, receiveUpdateState } from './update/updateActions'
import { receiveStatusLogCleared, receiveStatusLogEntry, startStatusLog } from './statusLog/statusLogActions'
import { useStatusLogStore } from './store/statusLogStore'
import { forgetRemovedText, markTextSaveFailed, primeSessionText, startTextAutosave } from './terminal/textPersistence'

const SAVE_DEBOUNCE_MS = 500

export default function App() {
  const session = useSessionStore((state) => state.session)
  const connected = useHostStore((state) => state.connected)
  const status = useHostStore((state) => state.status)

  useEffect(() => {
    const { load, setPanePath } = useSessionStore.getState()
    const { setHello, setStatus, setProjects, setUnsaved, applySettings, setPickedPath, setImportedPreferences } = useHostStore.getState()
    let stopAutosave: (() => void) | undefined
    const stopNotifier = startAttentionNotifier()
    const stopExternalDrops = startExternalDrops()
    const stopStatusLog = startStatusLog()
    const stopDeferredPreviews = startDeferredPreviews()
    const stopBrowserLayer = startBrowserLayer()
    const { markFailed, markExited, markPathMissing, markAlive } = usePaneStore.getState()
    const subscriptions = [
      bridge.on('app.hello', (message) => {
        setHello(message.version, message.shells, message.home, message.persistence)
        useStatusLogStore.getState().load(message.statusLog)
        terminalRegistry.configure(message.persistence.linesPerPane)
        terminalRegistry.setFontSize(message.appearance.fontSize)
        primeSessionText(message.session, message.text)
        void document.fonts.load('14px "Symbols Nerd Font Mono"').then(() => {
          load(message.session)
          stopAutosave?.()
          stopAutosave = startTextAutosave(message.persistence.textIntervalSeconds)
          if (message.recovery) {
            setStatus(message.recovery, StatusLevel.Warning)
          } else {
            setStatus(`Session restaurée${restoredSessionLabel(message.session)} : nouveaux shells, aucune commande rejouée.`)
          }
        })
      }),
      bridge.on('appearance.changed', (message) => {
        terminalRegistry.setFontSize(message.fontSize)
        setStatus(`Taille du texte des terminaux : ${message.fontSize} px`)
      }),
      bridge.on('settings.result', (message) => {
        applySettings({ settings: message.settings, shellSettings: message.shellSettings, files: message.files, warnings: message.warnings, agents: message.agents, mcp: message.mcp, notifications: message.notifications }, message.shells, message.persistence)
        if (!message.saved && !message.external) {
          return
        }
        terminalRegistry.configure(message.persistence.linesPerPane)
        terminalRegistry.setFontSize(message.settings.appearance.fontSize)
        stopAutosave?.()
        stopAutosave = startTextAutosave(message.persistence.textIntervalSeconds)
        if (message.external) {
          setStatus('Réglages modifiés dans une autre fenêtre de Tily : appliqués ici.')
          return
        }
        useUiStore.getState().closeSettings()
        const warnings = message.warnings.join(' ')
        setStatus(warnings.length > 0 ? `Réglages enregistrés. ${warnings}` : 'Réglages enregistrés et appliqués.', warnings.length > 0 ? StatusLevel.Warning : StatusLevel.Info)
      }),
      bridge.on('dialog.picked', (message) => {
        if (message.field === WORKTREE_REPOSITORY_FIELD) {
          receiveWorktreeRepositoryPicked(message.path)
        } else if (message.field === WORKTREE_FOLDER_FIELD) {
          receiveWorktreeFolderPicked(message.path)
        } else if (message.field === PROJECT_REPOSITORY_FIELD) {
          receiveProjectRepositoryPicked(message.path)
        } else {
          setPickedPath({ field: message.field, path: message.path })
        }
      }),
      bridge.on('settings.exported', (message) => setStatus(`Préférences exportées dans ${message.path}.`)),
      bridge.on('settings.imported', (message) => {
        setImportedPreferences({ settings: message.settings, path: message.path, warnings: message.warnings })
        setStatus(`Préférences lues depuis ${message.path} : Enregistrer remplace la configuration actuelle.`)
      }),
      bridge.on('app.closing', (message) => receiveApplicationClosing(message.activity)),
      bridge.on('terminal.activityResult', (message) => {
        if (!receiveQueriedActivity(message.request, message.panes)) {
          receiveActivity(message.panes)
        }
      }),
      bridge.on('agent.states', (message) => useAgentStore.getState().setAgents(message.panes)),
      bridge.on('agent.join', (message) => joinPane(message.pane)),
      bridge.on('session.saved', () => setUnsaved(false)),
      bridge.on('session.saveFailed', (message) => {
        setUnsaved(true)
        markTextSaveFailed()
        setStatus(`${message.message} Les changements ne sont pas enregistrés.`, StatusLevel.Error)
      }),
      bridge.on('terminal.output', (message) => terminalRegistry.write(message.pane, message.data)),
      bridge.on('terminal.dropped', (message) => insertIntoPane(message.pane, message.text)),
      bridge.on('terminal.cwd', (message) => {
        setPanePath(message.pane, message.path)
        markAlive(message.pane)
        queryContext(message.pane)
      }),
      bridge.on('terminal.pathMissing', (message) => markPathMissing(message.pane, message.path, message.fallback)),
      bridge.on('projects.listed', (message) => setProjects(message.root, message.projects, message.error ?? null)),
      bridge.on('projects.repositoriesFound', (message) => receiveProjectRepositories(message.request, message.sources)),
      bridge.on('projects.repositoryRemembered', (message) => receiveProjectRepositoryRemembered(message.project, message.repository)),
      bridge.on('context.result', (message) => receiveContext(message.pane, message.path, message.git)),
      bridge.on('files.listed', (message) => receiveListing(message.path, message.entries, message.total, message.error)),
      bridge.on('files.created', (message) => receiveCreated(message.path)),
      bridge.on('files.searched', receiveProjectFiles),
      bridge.on('files.gitMarks', (message) => receiveGitMarks(message.root, message.marks)),
      bridge.on('files.renamed', (message) => receiveRenamed(message.path, message.target)),
      bridge.on('files.deleted', (message) => receiveDeleted(message.path)),
      bridge.on('preview.loaded', receivePreview),
      bridge.on('preview.requested', receivePreviewRequest),
      bridge.on('preview.saved', receivePreviewSaved),
      bridge.on('preview.saveFailed', receivePreviewSaveFailed),
      bridge.on('git.state', (message) => receiveGitState(message.path, message.state, message.error, message.displayRoot)),
      bridge.on('git.changed', (message) => receiveGitChanged(message.path)),
      bridge.on('git.history', (message) => receiveGitHistory(message.history, message.error)),
      bridge.on('git.diff', (message) => receiveGitDiff(message.request, message.result, message.error)),
      bridge.on('git.details', (message) => receiveGitDetails(message.request, message.result, message.error)),
      bridge.on('git.done', (message) => receiveGitDone(message.operation, message.message, message.warning, message.output)),
      bridge.on('git.failed', (message) => receiveGitFailed(message.operation, message.message, message.output, message.code)),
      bridge.on('git.pushRejected', (message) => receiveGitPushRejected(message.operation, message.branch, message.message, message.output)),
      bridge.on('git.autoFetchStarted', (message) => receiveGitAutoFetchStarted(message.path)),
      bridge.on('git.autoFetchEnded', receiveGitAutoFetchEnded),
      bridge.on('worktrees.sourcesFound', (message) => dispatchReply(message.type, message.request, message) || receiveWorktreeSources(message.request, message.sources)),
      bridge.on('worktrees.planned', (message) => dispatchReply(message.type, message.request, message) || receiveWorktreePlan(message.request, message.plan)),
      bridge.on('worktrees.listed', (message) => dispatchReply(message.type, message.request, message)),
      bridge.on('worktrees.progress', (message) => receiveWorktreeProgress(message.operation, message.message)),
      bridge.on('worktrees.created', (message) => dispatchReply(message.type, message.request, message) || receiveWorktreeCreated(message.path, message.name, message.install)),
      bridge.on('worktrees.done', (message) => {
        dispatchReply(message.type, message.request, message)
        receiveWorktreeDone(message.operation, message.message, message.warnings)
      }),
      bridge.on('worktrees.failed', (message) => {
        if (!dispatchReply(message.type, message.request, message) || message.operation === WorktreeOperation.Remove) {
          receiveWorktreeFailed(message.operation, message.message, message.output, message.lockedBy)
        }
      }),
      bridge.on('update.state', (message) => receiveUpdateState(message)),
      bridge.on('update.restart', receiveUpdateRestart),
      bridge.on('update.confirmRestart', (message) => receiveRestartRequest(message.id, message.version)),
      bridge.on('update.notice', (message) => receiveUpdateNotice(message.message, message.warning)),
      bridge.on('statusLog.added', (message) => receiveStatusLogEntry(message.entry)),
      bridge.on('statusLog.cleared', receiveStatusLogCleared),
      bridge.on('mcp.request', (message) => void receiveMcpRequest(message)),
      bridge.on('browser.state', (message) => receiveBrowserState(message.state)),
      bridge.on('browser.newPane', (message) => receiveNewBrowserPane(message.pane, message.url)),
      bridge.on('browser.focused', (message) => receiveBrowserFocused(message.pane)),
      bridge.on('browser.key', (message) => receiveBrowserKey(message.key)),
      bridge.on('browser.failed', (message) => receiveBrowserFailure(message.pane, message.message)),
      bridge.on('browser.reply', (message) => dispatchReply(message.type, message.request, message)),
      bridge.on('terminal.exit', (message) => {
        terminalRegistry.markExited(message.pane, message.code)
        markExited(message.pane, message.code)
      }),
      bridge.on('error', (message) => {
        setStatus(message.message, StatusLevel.Error)
        if (message.pane) {
          markFailed(message.pane, message.message)
        }
      }),
    ]
    if (bridge.available) {
      bridge.send({ type: 'app.ready' })
    } else {
      setStatus('Cette page doit être ouverte dans l’hôte Tily : aucun pont détecté.', StatusLevel.Error)
    }
    return () => {
      stopNotifier()
      stopExternalDrops()
      stopStatusLog()
      stopDeferredPreviews()
      stopBrowserLayer()
      stopAutosave?.()
      subscriptions.forEach((unsubscribe) => unsubscribe())
    }
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    return useSessionStore.subscribe((state, previous) => {
      if (!state.session || state.session === previous.session) {
        return
      }
      const livePaneIds = new Set(allPanes(state.session).map((pane) => pane.id))
      const removed = terminalRegistry.disposeMissing(livePaneIds)
      disposeMissingBrowsers(livePaneIds)
      clearSeenCommandNotices()
      clearTimeout(timer)
      timer = setTimeout(() => {
        bridge.send({ type: 'session.save', session: state.session! })
        if (removed) {
          forgetRemovedText()
        }
      }, SAVE_DEBOUNCE_MS)
    })
  }, [])

  if (!session || !connected) {
    return <div className="flex h-full items-center justify-center text-tily-muted">{status.text}</div>
  }

  return <AppShell session={session} />
}
