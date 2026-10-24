import { useEffect, type KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { focusGitGraph } from '../git/gitFocus'
import { plural } from '../git/gitLabels'
import { followRepository, initializeRepository, refreshRepository } from '../git/gitRequests'
import { RightPanelView } from '../model/session'
import { togglePanelView } from '../panel/rightPanel'
import { useGitStore } from '../store/gitStore'
import { GitBanners } from './GitBanners'
import { GitChangesView } from './GitChangesView'
import { GitCommitDetail } from './GitCommitDetail'
import { GitHeader } from './GitHeader'
import { GitMergeRequests } from './GitMergeRequests'
import { GitPromptBar } from './GitPromptBar'
import { GIT_SECONDARY, SECTION_TITLE } from './rightPanelStyles'

interface GitPanelProps {
  folder: string
}

const handleEscape = (): void => {
  const store = useGitStore.getState()
  if (store.file) {
    store.closeDrawer()
  } else if (store.prompt) {
    store.setPrompt(null)
  } else if (!store.graphOpen || !focusGitGraph()) {
    focusActivePane()
  }
}

const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
  const key = event.key.toLowerCase()
  if (event.ctrlKey && event.shiftKey && key === 'g') {
    togglePanelView(RightPanelView.Git, true)
  } else if (event.ctrlKey && event.shiftKey && key === 'e') {
    togglePanelView(RightPanelView.Files, true)
  } else if (event.key === 'Escape') {
    handleEscape()
  } else if (event.key === 'F5') {
    if (!event.repeat) {
      refreshRepository()
    }
  } else {
    return
  }
  event.preventDefault()
  event.stopPropagation()
}

export function GitPanel({ folder }: GitPanelProps) {
  const { state, error, resolved, commit, prompt, busy } = useGitStore(
    useShallow((store) => ({ state: store.state, error: store.error, resolved: store.resolved, commit: store.commit, prompt: store.prompt, busy: store.busy })),
  )

  useEffect(() => {
    followRepository(folder)
  }, [folder])
  useEffect(
    () => () => {
      followRepository('')
      useGitStore.getState().clearSelection()
    },
    [],
  )

  const renderContent = () => {
    if (!state) {
      const loading = resolved !== folder
      const handleInitialize = () => initializeRepository(folder)
      return (
        <div className="flex flex-col gap-[6px] px-[12px] py-[8px] text-[12px]">
          <p className="text-tily-ink">{loading ? 'Lecture du dépôt Git…' : 'Aucun dépôt Git'}</p>
          {!loading && <p className="break-all text-tily-muted">{error ?? `Le dossier du pane actif n’appartient à aucun dépôt : ${folder}`}</p>}
          {!loading && !error && folder && (
            <button type="button" className={`${GIT_SECONDARY} self-start`} data-tip="git init dans le dossier du pane actif" onClick={handleInitialize}>
              Initialiser un dépôt Git ici
            </button>
          )}
        </div>
      )
    }
    const changeCount = state.stagedTotal + state.unstagedTotal + state.conflicts.length
    return (
      <>
        <GitHeader state={state} busy={busy} />
        <GitBanners state={state} busy={busy} />
        {prompt && <GitPromptBar key={`${prompt.kind}\n${prompt.target ?? ''}`} prompt={prompt} />}
        <GitMergeRequests root={state.root} branch={state.head.detached ? null : (state.head.branch ?? null)} />
        {commit ? (
          <GitCommitDetail state={state} busy={busy} />
        ) : (
          <>
            <div className="flex h-[30px] shrink-0 items-center gap-[8px] border-y border-tily-line px-[12px]">
              <span className={SECTION_TITLE}>Modifications</span>
              <span className="text-[11px] text-tily-muted">{changeCount > 0 ? plural(changeCount, 'fichier', 'fichiers') : 'aucune'}</span>
            </div>
            <GitChangesView state={state} busy={busy} />
          </>
        )}
      </>
    )
  }

  return (
    <section aria-label="Git" data-git-panel="" tabIndex={-1} className="@container relative flex min-h-0 flex-1 flex-col focus:outline-none" onKeyDown={handleKeyDown}>
      {busy && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] animate-pulse bg-tily-green" />}
      {renderContent()}
    </section>
  )
}
