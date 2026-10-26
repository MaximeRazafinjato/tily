import { useEffect, type ChangeEvent, type MouseEvent, type PointerEvent, type SubmitEvent } from 'react'
import { WorktreeBranchMode, type WorktreePlan, type WorktreeSources } from '../bridge/worktreeMessages'
import { folderName } from '../model/session'
import type { WorktreeDraft, WorktreeFailure } from '../store/worktreeStore'
import { browseWorktreeRepository, changeWorktreeDraft, closeWorktreeDialog, submitWorktree } from '../worktree/worktreeActions'
import { repositoryLabel, sameFolder } from '../worktree/worktreePaths'
import { keepTabInside } from './focusTrap'
import { SETTINGS_BROWSE, SETTINGS_BUTTON, SETTINGS_HINT, SETTINGS_INPUT, SETTINGS_SECONDARY } from './settingsStyles'
import { Spinner } from './Spinner'
import { Icon } from './Icon'
import { InfoTip } from './InfoTip'
import { IconName } from './iconName'
import { WorktreeFailureDetails } from './WorktreeFailureDetails'
import { WorktreeFolderField } from './WorktreeFolderField'

interface WorktreeDialogProps {
  draft: WorktreeDraft
  sources: WorktreeSources | null
  plan: WorktreePlan | null
  planPending: boolean
  busy: boolean
  failure: WorktreeFailure | null
}

const PRIMARY = `${SETTINGS_BUTTON} flex items-center gap-2 border-tily-green text-tily-green-deep hover:bg-tily-green-soft disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent`
const CHECKBOX_LABEL = 'flex items-center gap-2 text-[12px] text-tily-ink'
const ROW_LABEL = 'flex min-h-[28px] items-center text-[12px] text-tily-muted'
const BROWSE_REPOSITORY = 'Parcourir les dépôts'
const LOCAL_GROUP = 'Locales'
const REMOTE_GROUP = 'Distantes'

const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
  event.preventDefault()
  submitWorktree()
}

const handleNewMode = () => changeWorktreeDraft({ mode: WorktreeBranchMode.New, branch: '' })
const handleExistingMode = () => changeWorktreeDraft({ mode: WorktreeBranchMode.Local, branch: '' })
const handleBranchChange = (event: ChangeEvent<HTMLInputElement>) => changeWorktreeDraft({ branch: event.target.value })
const handleBaseChange = (event: ChangeEvent<HTMLSelectElement>) => changeWorktreeDraft({ base: event.target.value })
const handleInstallChange = (event: ChangeEvent<HTMLInputElement>) => changeWorktreeDraft({ install: event.target.checked })
const handleClaudeChange = (event: ChangeEvent<HTMLInputElement>) => changeWorktreeDraft({ claude: event.target.checked })
const handleRepositoryChange = (event: ChangeEvent<HTMLSelectElement>) => changeWorktreeDraft({ repository: event.target.value })
const handleRememberChange = (event: ChangeEvent<HTMLInputElement>) => changeWorktreeDraft({ remember: event.target.checked })
const handleDatabaseChange = (event: ChangeEvent<HTMLInputElement>) => changeWorktreeDraft({ database: event.target.checked })

const modeButton = (pressed: boolean) =>
  `h-[22px] cursor-pointer rounded px-2.5 text-[12px] ${pressed ? 'bg-tily-green-soft text-tily-green-deep' : 'text-tily-ink-soft hover:bg-tily-green-hover'}`

const branchOptions = (label: string, branches: string[]) =>
  branches.length > 0 && (
    <optgroup label={label}>
      {branches.map((branch) => (
        <option key={branch} value={branch}>
          {branch}
        </option>
      ))}
    </optgroup>
  )

export function WorktreeDialog({ draft, sources, plan, planPending, busy, failure }: WorktreeDialogProps) {
  const creating = draft.mode === WorktreeBranchMode.New
  const localBranches = plan?.localBranches ?? []
  const remoteBranches = plan?.remoteBranches ?? []
  const defaultBase = plan?.defaultBase ?? ''
  const baseValue = draft.base || defaultBase
  const extraBase = [...new Set([baseValue, plan?.configuredBase ?? ''])].filter((base) => base && !remoteBranches.includes(base) && !localBranches.includes(base))
  const canCreate = Boolean(plan?.path) && !plan?.error && !planPending && !busy
  const project = folderName(draft.project)
  const guarded = creating && draft.branch.trim().length > 0
  const repositories = sources ? [...new Set([...sources.repositories, draft.repository])].filter(Boolean) : []
  const differsFromDefault = sources !== null && !sameFolder(draft.repository, sources.defaultRepository ?? '')
  const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !guarded) {
      closeWorktreeDialog()
    }
  }
  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && guarded) {
      event.preventDefault()
    }
  }

  useEffect(() => {
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeWorktreeDialog()
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [])

  const handleExistingChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const branch = event.target.value
    changeWorktreeDraft({ branch, mode: remoteBranches.includes(branch) ? WorktreeBranchMode.Remote : WorktreeBranchMode.Local })
  }

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-tily-paper/60 pt-[10vh]" onPointerDown={handleBackdropPointerDown} onMouseDown={handleBackdropMouseDown}>
      <form role="dialog" aria-label="Créer un worktree" className="flex max-h-[80vh] w-[560px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={keepTabInside} onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 border-b border-tily-line px-4 py-3">
          <h2 className="flex min-w-0 items-baseline gap-2 text-[15px] font-semibold text-tily-ink">
            Créer un worktree
            <span className="truncate text-[13px] font-normal text-tily-muted" data-tip={draft.project}>{`· ${project}`}</span>
          </h2>
          <InfoTip text="Les ports de développement du worktree sont toujours remplacés par des ports libres." />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-4 overflow-y-auto px-4 py-4">
          <span className={ROW_LABEL}>Dépôt</span>
          <fieldset className="flex min-w-0 flex-col gap-2" disabled={busy || !sources}>
            <div className="flex gap-1">
              <select className={SETTINGS_INPUT} value={draft.repository} aria-label="Dépôt Git du worktree" onChange={handleRepositoryChange}>
                {!sources && <option value="">Recherche des dépôts…</option>}
                {repositories.map((repository) => (
                  <option key={repository} value={repository}>
                    {repositoryLabel(repository, draft.project)}
                  </option>
                ))}
              </select>
              <button type="button" className={SETTINGS_BROWSE} aria-label={BROWSE_REPOSITORY} data-tip={BROWSE_REPOSITORY} onClick={browseWorktreeRepository}>
                <Icon name={IconName.Folder} />
              </button>
            </div>
            {plan && !sameFolder(plan.repository, draft.repository) && <span className={`${SETTINGS_HINT} truncate`}>{plan.repository}</span>}
            {differsFromDefault && (
              <label className={CHECKBOX_LABEL}>
                <input type="checkbox" checked={draft.remember} onChange={handleRememberChange} />
                Par défaut pour ce projet
              </label>
            )}
          </fieldset>
          <span className={ROW_LABEL}>Branche</span>
          <fieldset className="flex min-w-0 flex-col gap-2" disabled={busy}>
            <div className="flex self-start rounded border border-tily-line p-[2px]" role="group" aria-label="Type de branche">
              <button type="button" aria-pressed={creating} className={modeButton(creating)} onClick={handleNewMode}>
                Nouvelle
              </button>
              <button type="button" aria-pressed={!creating} className={modeButton(!creating)} onClick={handleExistingMode}>
                Existante
              </button>
            </div>
            {creating ? (
              <>
                <input type="text" className={SETTINGS_INPUT} value={draft.branch} placeholder="feat/ma-branche" spellCheck={false} autoFocus aria-label="Nom de la nouvelle branche" onChange={handleBranchChange} />
                <label className="flex items-center gap-2">
                  <span className={`${SETTINGS_HINT} shrink-0`}>depuis</span>
                  <select className={SETTINGS_INPUT} value={baseValue} aria-label="Base de la nouvelle branche" onChange={handleBaseChange}>
                    {branchOptions('Base par défaut', extraBase)}
                    {branchOptions(REMOTE_GROUP, remoteBranches)}
                    {branchOptions(LOCAL_GROUP, localBranches)}
                  </select>
                </label>
              </>
            ) : (
              <select className={SETTINGS_INPUT} value={draft.branch} autoFocus aria-label="Branche existante" onChange={handleExistingChange}>
                <option value="">Choisir une branche…</option>
                {branchOptions(LOCAL_GROUP, localBranches)}
                {branchOptions(REMOTE_GROUP, remoteBranches)}
              </select>
            )}
          </fieldset>
          <span className={ROW_LABEL}>Dossier</span>
          <fieldset className="min-w-0" disabled={busy}>
            <WorktreeFolderField draft={draft} plan={plan} project={project} checkboxLabel={CHECKBOX_LABEL} />
          </fieldset>
          <span className={ROW_LABEL}>Options</span>
          <fieldset className="min-w-0" disabled={busy}>
            <div className="flex min-h-[28px] flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5">
                <label className={CHECKBOX_LABEL}>
                  <input type="checkbox" checked={draft.claude} onChange={handleClaudeChange} />
                  Claude Code
                </label>
                <InfoTip text="claude démarre dans le terminal du worktree ; pnpm install tourne alors dans un pane en dessous." />
              </span>
              <span className="flex items-center gap-1.5">
                <label className={CHECKBOX_LABEL}>
                  <input type="checkbox" checked={draft.install} onChange={handleInstallChange} />
                  pnpm install
                </label>
                <InfoTip text="Lancé dans le terminal du worktree, si package.json existe." />
              </span>
              <span className="flex items-center gap-1.5">
                <label className={CHECKBOX_LABEL}>
                  <input type="checkbox" checked={draft.database} onChange={handleDatabaseChange} />
                  Répliquer la base
                </label>
                <InfoTip text="PostgreSQL sous Docker ou SQL Server." />
              </span>
            </div>
          </fieldset>
          {failure && (
            <div className="col-span-2">
              <WorktreeFailureDetails failure={failure} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-tily-line px-4 py-3">
          <button type="button" className={SETTINGS_SECONDARY} data-tip="Échap" onClick={closeWorktreeDialog}>
            {busy ? 'Fermer' : 'Annuler'}
          </button>
          <button type="submit" className={PRIMARY} disabled={!canCreate} data-tip="Entrée">
            {busy && <Spinner size={10} className="text-tily-green" />}
            {busy ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}
