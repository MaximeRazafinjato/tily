import { lazy, Suspense, type KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GitConflictResolution, GitConflictView } from '../bridge/gitMessages'
import { ConflictSide, keepLabel } from '../git/conflictLayout'
import { closeConflict, takeConflictSide } from '../git/gitConflictActions'
import { openInEditor } from '../git/gitRequests'
import { useGitStore } from '../store/gitStore'
import { GitConflictChoice } from './GitConflictChoice'
import { GitToolButton } from './GitToolButton'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { PANEL_HEADER_BUTTON } from './rightPanelStyles'

const GitConflictMerge = lazy(() => import('./GitConflictMerge').then((module) => ({ default: module.GitConflictMerge })))

const MESSAGE = 'p-[16px] text-[13px]'

const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    event.stopPropagation()
    closeConflict()
  }
}

const handleKeepOurs = () => takeConflictSide(GitConflictResolution.Ours)
const handleKeepTheirs = () => takeConflictSide(GitConflictResolution.Theirs)

export function GitConflictDrawer() {
  const { path, file, error } = useGitStore(useShallow((store) => ({ path: store.conflictPath, file: store.conflictFile, error: store.conflictError })))
  if (!path) {
    return null
  }
  const shown = file?.path === path ? file : null
  const handleEdit = () => openInEditor(path)

  return (
    <aside aria-label="Résolution du conflit" data-git-drawer="" className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-tily-line bg-tily-panel shadow-2xl" onKeyDown={handleKeyDown}>
      <header className="flex h-[36px] shrink-0 items-center gap-[8px] border-b border-tily-line pr-[6px] pl-[12px]">
        <span className="shrink-0 rounded bg-tily-paper px-[6px] py-[1px] text-[11px] text-tily-error">Conflit</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-tily-ink" data-tip={path}>
          {path}
        </span>
        {shown?.view === GitConflictView.Text && (
          <span className="flex shrink-0 items-center gap-[2px]">
            <GitToolButton icon={IconName.Check} label={keepLabel(ConflictSide.Ours, shown.sides)} tip="Remplacer tout le fichier par la version courante" onClick={handleKeepOurs} />
            <GitToolButton icon={IconName.Check} label={keepLabel(ConflictSide.Theirs, shown.sides)} tip="Remplacer tout le fichier par la version entrante" onClick={handleKeepTheirs} />
          </span>
        )}
        <GitToolButton icon={IconName.Editor} tip="Ouvrir dans l’éditeur" onClick={handleEdit} />
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Fermer" data-tip="Fermer (Échap)" onClick={closeConflict}>
          <Icon name={IconName.Close} />
        </button>
      </header>
      {error ? (
        <p className={`${MESSAGE} text-tily-error`}>{error}</p>
      ) : !shown ? (
        <p className={`${MESSAGE} text-tily-muted`}>Chargement du conflit…</p>
      ) : shown.view === GitConflictView.Text ? (
        <Suspense fallback={<p className={`${MESSAGE} text-tily-muted`}>Chargement du résolveur…</p>}>
          <GitConflictMerge file={shown} />
        </Suspense>
      ) : (
        <GitConflictChoice file={shown} />
      )}
    </aside>
  )
}
