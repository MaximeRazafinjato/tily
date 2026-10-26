import { useShallow } from 'zustand/react/shallow'
import { GitHistoryScope, type GitState } from '../bridge/gitMessages'
import { canSearchCommits, openCommitPicker } from '../git/commitSearch'
import { setHistoryScope } from '../git/gitRequests'
import { hideGitGraph } from '../panel/rightPanel'
import { useGitStore } from '../store/gitStore'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { PANEL_HEADER_BUTTON } from './rightPanelStyles'

interface GitGraphToolbarProps {
  state: GitState
  referencesShown: boolean
  onToggleReferences: () => void
}

const handleSearch = (): void => {
  if (canSearchCommits()) {
    openCommitPicker()
  }
}

const SCOPES: { scope: GitHistoryScope; label: string; tip: string }[] = [
  { scope: GitHistoryScope.All, label: 'Toutes', tip: 'Branches locales, branches distantes et tags' },
  { scope: GitHistoryScope.Current, label: 'Courante', tip: 'Branche courante et sa branche distante suivie' },
]

export function GitGraphToolbar({ state, referencesShown, onToggleReferences }: GitGraphToolbarProps) {
  const { history, scope } = useGitStore(useShallow((store) => ({ history: store.history, scope: store.scope })))

  const renderScope = (entry: (typeof SCOPES)[number]) => {
    const handleScope = () => setHistoryScope(entry.scope)
    return (
      <button
        key={entry.scope}
        type="button"
        role="radio"
        aria-checked={entry.scope === scope}
        data-tip={entry.tip}
        className={`rounded px-[7px] py-[1px] text-[11px] ${entry.scope === scope ? 'bg-tily-green-soft text-tily-green-deep' : 'text-tily-muted hover:text-tily-ink'}`}
        onClick={handleScope}
      >
        {entry.label}
      </button>
    )
  }

  return (
    <div className="flex h-[36px] shrink-0 items-center gap-[8px] border-b border-tily-line pr-[6px] pl-[6px]">
      <button
        type="button"
        className={`${PANEL_HEADER_BUTTON} aria-pressed:text-tily-green-deep`}
        aria-pressed={referencesShown}
        aria-label="Branches, tags et stash"
        data-tip={referencesShown ? 'Masquer les branches, tags et stash' : 'Afficher les branches, tags et stash'}
        onClick={onToggleReferences}
      >
        <Icon name={IconName.Sidebar} />
      </button>
      <span className="min-w-0 truncate text-[12px] font-semibold text-tily-ink" data-tip={state.root}>
        {state.name}
      </span>
      {!history && <span className="shrink-0 text-[11px] text-tily-muted">Chargement de l’historique…</span>}
      <span className="flex-1" />
      <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Rechercher un commit" data-tip="Rechercher un commit" aria-disabled={!history || history.commits.length === 0} onClick={handleSearch}>
        <Icon name={IconName.Search} />
      </button>
      <div role="radiogroup" aria-label="Branches affichées" className="flex shrink-0 rounded-md bg-tily-paper p-[2px]">
        {SCOPES.map(renderScope)}
      </div>
      <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Fermer le graphe" data-tip="Fermer le graphe (Échap)" onClick={hideGitGraph}>
        <Icon name={IconName.Close} />
      </button>
    </div>
  )
}
