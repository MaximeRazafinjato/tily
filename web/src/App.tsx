import { useEffect } from 'react'
import { clearSeenCommandNotices } from './terminal/commandNotices'
import { startAttentionNotifier } from './agents/attentionNotifier'
import { startCompanions } from './companions/companionLoader'
import { announceShinyCompanions } from './companions/shinyAnnouncement'
import { AMBIANCE_MEDIA_FIELD, AMBIANCE_MEDIA_PICK_FIELD, importAmbianceMedia, receiveAmbiance, startAmbiance } from './ambiance/ambianceActions'
import { receiveAppearance, receiveAppearanceCatalog, receiveProjects, startAppearanceProjects } from './appearance/appearanceActions'
import { bridge } from './bridge/bridge'
import { receiveBrowserFailure, receiveBrowserFocused, receiveBrowserState, receiveNewBrowserPane } from './browser/browserActions'
import { receiveBrowserKey } from './browser/browserKeys'
import { disposeMissingBrowsers, startBrowserLayer } from './browser/browserLayer'
import { dispatchReply } from './bridge/requestListeners'
import { AppShell } from './components/AppShell'
import { receiveMcpRequest } from './mcp/mcpRequests'
import { allPanes, emptySession, restoredSessionLabel } from './model/session'
import { forgetMissingNoteHistories } from './notes/noteHistory'
import { useAgentStore } from './store/agentStore'
import { StatusLevel, useHostStore } from './store/hostStore'
import { usePaneStore } from './store/paneStore'
import { useSessionStore } from './store/sessionStore'
import { useUiStore } from './store/uiStore'
import { isDetachedWindow, useWindowStore } from './store/windowStore'
import { applyPendingTransfers, receiveTransfer } from './window/windowReceive'
import { receiveDragLeave, receiveDragOver } from './window/windowDrag'
import { showWorkspaceNote, startLinkedNoteSync, startWindowSync } from './window/windowSync'
import { receiveActivity, receiveApplicationClosing } from './terminal/closeGuard'
import { receiveQueriedActivity } from './terminal/paneActivity'
import { queryContext, receiveContext } from './terminal/contextActions'
import { receiveBranchMergeRequests, receiveMergeRequestList } from './forge/mergeRequestActions'
import { receiveMergeRequestComparison, receiveMergeRequestCreated, receiveMergeRequestForm, receiveMergeRequestUpdated } from './forge/mergeRequestFormActions'
import { startExternalDrops } from './terminal/externalDrop'
import { receiveCreated, receiveDeleted, receiveGitMarks, receiveListing, receiveRenamed } from './explorer/fileExplorerActions'
import { receiveProjectFiles } from './explorer/projectFileActions'
import { receivePreview, receivePreviewRequest, startTabPreviews } from './preview/previewActions'
import { receivePreviewSaved, receivePreviewSaveFailed } from './preview/previewEdit'
import { receiveGitConflict } from './git/gitConflictActions'
import { receiveGitAutoFetchEnded, receiveGitAutoFetchStarted, receiveGitChanged, receiveGitDetails, receiveGitDiff, receiveGitDone, receiveGitFailed, receiveGitHistory, receiveGitPushRejected, receiveGitState } from './git/gitReceivers'
import { insertIntoPane, joinPane } from './terminal/terminalActions'
import { WORKTREE_FOLDER_FIELD, WORKTREE_REPOSITORY_FIELD } from './worktree/worktreeActions'
import { CLONE_FOLDER_FIELD } from './clone/cloneActions'
import { receiveCloneDone, receiveCloneFailed, receiveCloneFolderPicked, receiveClonePlan, receiveCloneProgress, receiveCloneSuggestion } from './clone/cloneReceivers'
import { PROJECT_FOLDER_FIELD, PROJECT_REPOSITORY_FIELD, receiveProjectFolderPicked, receiveProjectRepositories, receiveProjectRepositoryPicked, receiveProjectRepositoryRemembered } from './project/projectOpenActions'
import {
  receiveWorktreeCreated,
  receiveWorktreeDone,
  receiveWorktreeFailed,
  receiveWorktreePlan,
  receiveWorktreeProgress,
  receiveWorktreePurged,
  receiveWorktreePurging,
  receiveWorktreeFolderPicked,
  receiveWorktreeRepositoryPicked,
  receiveWorktreeSources,
} from './worktree/worktreeReceivers'
import { terminalRegistry } from './terminal/terminalRegistry'
import { receiveReleaseHistory, receiveUpdateRestart, receiveUpdateState } from './update/updateActions'
import { receiveStatusLogCleared, receiveStatusLogEntry, startStatusLog } from './statusLog/statusLogActions'
import { useShortcutStore } from './store/shortcutStore'
import { useActivityStore } from './store/activityStore'
import { useStatusLogStore } from './store/statusLogStore'
import { forgetRemovedText, markTextSaveFailed, primeSessionText, startTextAutosave } from './terminal/textPersistence'

const SAVE_DEBOUNCE_MS = 500
const DETACHED_STATUS = 'Fenêtre détachée : rien n’y est enregistré, les Paramètres restent dans la fenêtre principale.'

export default function App() {
  const session = useSessionStore((state) => state.session)
  const connected = useHostStore((state) => state.connected)
  const waitingText = useHostStore((state) => (session && state.connected ? '' : state.status.text))

  useEffect(() => {
    const { load, setPanePath } = useSessionStore.getState()
    const { setHello, setStatus, setProjects, setUnsaved, applySettings, setPickedPath, setImportedPreferences } = useHostStore.getState()
    let stopAutosave: (() => void) | undefined
    const stopNotifier = startAttentionNotifier()
    const stopExternalDrops = startExternalDrops()
    const stopStatusLog = startStatusLog()
    const stopTabPreviews = startTabPreviews()
    const stopBrowserLayer = startBrowserLayer()
    const stopAppearanceProjects = startAppearanceProjects()
    const stopAmbiance = startAmbiance()
    const stopCompanions = startCompanions()
    const stopWindowSync = startWindowSync()
    const stopLinkedNoteSync = startLinkedNoteSync()
    const { markFailed, markExited, markPathMissing, markAlive } = usePaneStore.getState()
    const subscriptions = [
      bridge.on('app.hello', (message) => {
        useWindowStore.getState().setWindow(message.window)
        const session = message.session ?? emptySession()
        setHello(message.version, message.name, message.shells, message.home, message.persistence)
        receiveAppearanceCatalog(message.theme)
        useShortcutStore.getState().setShortcuts(message.shortcuts)
        useStatusLogStore.getState().load(message.statusLog)
        terminalRegistry.configure(message.persistence.linesPerPane)
        terminalRegistry.setFontSize(message.appearance.fontSize)
        receiveAmbiance(message.appearance.ambiance)
        primeSessionText(session, message.text)
        void document.fonts.load('14px "Symbols Nerd Font Mono"').then(() => {
          load(session)
          applyPendingTransfers()
          if (message.window.detached) {
            setStatus(DETACHED_STATUS)
            return
          }
          stopAutosave?.()
          stopAutosave = startTextAutosave(message.persistence.textIntervalSeconds)
          if (message.recovery) {
            setStatus(message.recovery, StatusLevel.Warning)
          } else {
            setStatus(`Session restaurée${restoredSessionLabel(session)} : nouveaux shells, aucune commande rejouée.`)
          }
        })
      }),
      bridge.on('appearance.changed', (message) => {
        terminalRegistry.setFontSize(message.fontSize)
        setStatus(`Taille du texte des terminaux : ${message.fontSize} px`)
      }),
      bridge.on('appearance.ambiance', (message) => {
        receiveAmbiance(message.ambiance)
        setStatus(message.ambiance.enabled ? 'Ambiance activée.' : 'Ambiance coupée.')
      }),
      bridge.on('appearance.mediaImported', (message) => setPickedPath({ field: AMBIANCE_MEDIA_FIELD, path: message.name })),
      bridge.on('appearance.theme', (message) => receiveAppearance(message.state)),
      bridge.on('appearance.projectsResolved', (message) => receiveProjects(message.projects)),
      bridge.on('settings.result', (message) => {
        applySettings({ settings: message.settings, shellSettings: message.shellSettings, files: message.files, warnings: message.warnings, agents: message.agents, shinyEncounters: message.shinyEncounters, mcp: message.mcp, notifications: message.notifications, shortcutDefaults: message.shortcutDefaults }, message.shells, message.persistence)
        useShortcutStore.getState().setShortcuts(message.settings.shortcuts)
        if (!message.saved) {
          return
        }
        terminalRegistry.configure(message.persistence.linesPerPane)
        terminalRegistry.setFontSize(message.settings.appearance.fontSize)
        receiveAmbiance(message.settings.appearance.ambiance)
        if (isDetachedWindow()) {
          setStatus('Réglages de la fenêtre principale appliqués.')
          return
        }
        stopAutosave?.()
        stopAutosave = startTextAutosave(message.persistence.textIntervalSeconds)
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
        } else if (message.field === PROJECT_FOLDER_FIELD) {
          receiveProjectFolderPicked(message.path)
        } else if (message.field === CLONE_FOLDER_FIELD) {
          receiveCloneFolderPicked(message.path)
        } else if (message.field === AMBIANCE_MEDIA_PICK_FIELD) {
          importAmbianceMedia(message.path)
        } else {
          setPickedPath({ field: message.field, path: message.path })
        }
      }),
      bridge.on('settings.exported', (message) => setStatus(`Préférences exportées dans ${message.path}.`)),
      bridge.on('settings.imported', (message) => {
        setImportedPreferences({ settings: message.settings, path: message.path, warnings: message.warnings })
        setStatus(`Préférences lues depuis ${message.path} : Enregistrer remplace la configuration actuelle.`)
      }),
      bridge.on('app.closing', (message) => receiveApplicationClosing(message.activity, message.detached)),
      bridge.on('window.receive', receiveTransfer),
      bridge.on('window.transferred', (message) => dispatchReply(message.type, message.request, message)),
      bridge.on('terminal.held', (message) => dispatchReply(message.type, message.request, message)),
      bridge.on('window.detached', (message) => useWindowStore.getState().setDetachedTabs(message.tabs)),
      bridge.on('window.mainWorkspaces', (message) => useWindowStore.getState().setMainWorkspaces(message.workspaces)),
      bridge.on('window.showNote', (message) => showWorkspaceNote(message.workspace)),
      bridge.on('window.dragOver', (message) => receiveDragOver(message.x, message.y, message.single)),
      bridge.on('window.dragLeave', receiveDragLeave),
      bridge.on('terminal.activityResult', (message) => {
        if (!receiveQueriedActivity(message.request, message.panes)) {
          receiveActivity(message.panes)
        }
      }),
      bridge.on('agent.states', (message) => useAgentStore.getState().setAgents(message.panes)),
      bridge.on('agent.join', (message) => joinPane(message.pane)),
      bridge.on('companions.shiny', (message) => announceShinyCompanions(message.encounters, message.total)),
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
      bridge.on('projects.listed', (message) => setProjects(message.root, message.projects, message.error ?? null, message.additionalRoots)),
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
      bridge.on('forge.listed', (message) => receiveMergeRequestList(message.request, message.list, message.error)),
      bridge.on('forge.branchListed', (message) => receiveBranchMergeRequests(message.path, message.branch, message.result)),
      bridge.on('forge.formLoaded', (message) => receiveMergeRequestForm(message.request, message.form, message.error)),
      bridge.on('forge.compared', (message) => receiveMergeRequestComparison(message.request, message.branch, message.error)),
      bridge.on('forge.created', (message) => receiveMergeRequestCreated(message.request, message.path, message.source, message.created, message.error)),
      bridge.on('forge.updated', (message) => receiveMergeRequestUpdated(message.request, message.path, message.source, message.updated, message.error)),
      bridge.on('git.state', (message) => receiveGitState(message.path, message.state, message.error, message.displayRoot)),
      bridge.on('git.changed', (message) => receiveGitChanged(message.path)),
      bridge.on('git.history', (message) => receiveGitHistory(message.history, message.error)),
      bridge.on('git.diff', (message) => receiveGitDiff(message.request, message.result, message.error)),
      bridge.on('git.details', (message) => receiveGitDetails(message.request, message.result, message.error)),
      bridge.on('git.conflict', (message) => receiveGitConflict(message.request, message.result, message.error)),
      bridge.on('git.done', (message) => receiveGitDone(message.operation, message.message, message.warning, message.output)),
      bridge.on('git.failed', (message) => receiveGitFailed(message.operation, message.message, message.output, message.code)),
      bridge.on('git.pushRejected', (message) => receiveGitPushRejected(message.operation, message.branch, message.message, message.output)),
      bridge.on('git.autoFetchStarted', (message) => receiveGitAutoFetchStarted(message.path)),
      bridge.on('git.autoFetchEnded', receiveGitAutoFetchEnded),
      bridge.on('worktrees.sourcesFound', (message) => dispatchReply(message.type, message.request, message) || receiveWorktreeSources(message.request, message.sources)),
      bridge.on('worktrees.planned', (message) => dispatchReply(message.type, message.request, message) || receiveWorktreePlan(message.request, message.plan)),
      bridge.on('worktrees.listed', (message) => dispatchReply(message.type, message.request, message)),
      bridge.on('worktrees.progress', (message) => receiveWorktreeProgress(message.message)),
      bridge.on('worktrees.created', (message) => dispatchReply(message.type, message.request, message) || receiveWorktreeCreated(message.path, message.name, message.install, message.claude)),
      bridge.on('worktrees.done', (message) => {
        dispatchReply(message.type, message.request, message)
        receiveWorktreeDone(message.request, message.message, message.warnings)
      }),
      bridge.on('worktrees.failed', (message) => {
        dispatchReply(message.type, message.request, message)
        receiveWorktreeFailed(message.request, message.operation, message.message, message.output, message.lockedBy)
      }),
      bridge.on('worktrees.purging', (message) => receiveWorktreePurging(message.name, message.files, message.elapsedMs)),
      bridge.on('worktrees.purged', (message) => receiveWorktreePurged(message.names, message.files, message.elapsedMs, message.remaining)),
      bridge.on('clone.suggested', (message) => receiveCloneSuggestion(message.request, message.address)),
      bridge.on('clone.planned', (message) => receiveClonePlan(message.request, message.plan, message.roots)),
      bridge.on('clone.progress', (message) => receiveCloneProgress(message.message)),
      bridge.on('clone.done', (message) => receiveCloneDone(message.request, message.path, message.name, message.install, message.claude, message.message)),
      bridge.on('clone.failed', (message) => receiveCloneFailed(message.request, message.message, message.output)),
      bridge.on('update.state', (message) => receiveUpdateState(message)),
      bridge.on('update.restart', receiveUpdateRestart),
      bridge.on('update.history', (message) => receiveReleaseHistory(message)),
      bridge.on('statusLog.added', (message) => receiveStatusLogEntry(message.entry)),
      bridge.on('statusLog.cleared', receiveStatusLogCleared),
      bridge.on('activity.state', (message) => useActivityStore.getState().setUsage(message.panes, message.host)),
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
      stopTabPreviews()
      stopBrowserLayer()
      stopAppearanceProjects()
      stopAmbiance()
      stopCompanions()
      stopWindowSync()
      stopLinkedNoteSync()
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
      forgetMissingNoteHistories(new Set(state.session.workspaces.map((workspace) => workspace.id)))
      clearSeenCommandNotices()
      clearTimeout(timer)
      if (isDetachedWindow()) {
        return
      }
      timer = setTimeout(() => {
        bridge.send({ type: 'session.save', session: state.session! })
        if (removed) {
          forgetRemovedText()
        }
      }, SAVE_DEBOUNCE_MS)
    })
  }, [])

  if (!session || !connected) {
    return <div className="flex h-full items-center justify-center text-tily-muted">{waitingText}</div>
  }

  return <AppShell session={session} />
}
