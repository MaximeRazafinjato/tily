import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { closeColorDialog, setProjectColor, setTabColor, setWorkspaceColor, workspacePath } from '../appearance/appearanceActions'
import type { FolderProject } from '../bridge/appearanceMessages'
import { findWorkspace, type Tab, type Workspace } from '../model/session'
import { projectKey, useAppearanceStore } from '../store/appearanceStore'
import { useSessionStore } from '../store/sessionStore'
import { AccentSwatches } from './AccentSwatches'
import { keepTabInside } from './focusTrap'
import { InfoTip } from './InfoTip'
import { SETTINGS_PRIMARY } from './settingsStyles'

interface ColorContentProps {
  workspace: Workspace
  tab?: Tab
  folder?: FolderProject
}

enum ColorScope {
  Workspace = 'workspace',
  Project = 'project',
}

const WORKSPACE_TIP = 'Surligne le nom du workspace. La couleur d’un projet s’applique à tout workspace dont le pane actif est dans ce projet, worktrees compris ; celle du workspace l’emporte.'
const TAB_TIP = 'Surligne le nom de l’onglet. Un onglet n’hérite pas de la couleur de son workspace.'
const RADIO = 'flex items-center gap-2 text-[12px] text-tily-ink has-[:disabled]:text-tily-muted'

function ColorContent({ workspace, tab, folder }: ColorContentProps) {
  const presets = useAppearanceStore((store) => store.accentPresets)
  const project = folder?.project
  const [scope, setScope] = useState(project && folder?.color && !workspace.color ? ColorScope.Project : ColorScope.Workspace)
  const closeRef = useRef<HTMLButtonElement>(null)
  const projectScope = !tab && scope === ColorScope.Project && project !== undefined
  const title = tab ? `Couleur de l’onglet « ${tab.name} »` : `Couleur de « ${workspace.name} »`
  const inherited = !tab && !projectScope ? folder?.color : undefined
  const value = tab ? tab.color : projectScope ? folder?.color : workspace.color

  useEffect(() => {
    closeRef.current?.focus()
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeColorDialog()
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [])

  const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeColorDialog()
    }
  }
  const handleScopeChange = (event: ChangeEvent<HTMLInputElement>) => setScope(event.target.value as ColorScope)
  const handleColorChange = (color: string | undefined) => {
    if (tab) {
      setTabColor(tab.id, color)
    } else if (projectScope) {
      setProjectColor(project, color)
    } else {
      setWorkspaceColor(workspace.id, color)
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-tily-paper/60 pt-[12vh]" onPointerDown={handleBackdropPointerDown}>
      <div role="dialog" aria-label={title} className="flex w-[460px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={keepTabInside}>
        <div className="flex items-center gap-1.5 border-b border-tily-line px-4 py-3">
          <h2 className="min-w-0 truncate text-[15px] font-semibold text-tily-ink">{title}</h2>
          <InfoTip text={tab ? TAB_TIP : WORKSPACE_TIP} />
        </div>
        <div className="flex flex-col gap-3 px-4 py-4">
          {!tab && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[12px] text-tily-muted">S’applique à</legend>
              <label className={RADIO}>
                <input type="radio" name="color-scope" value={ColorScope.Workspace} checked={!projectScope} onChange={handleScopeChange} />
                Ce workspace
              </label>
              <label className={RADIO}>
                <input type="radio" name="color-scope" value={ColorScope.Project} checked={projectScope} disabled={!project} onChange={handleScopeChange} />
                {folder?.projectName ? `Le projet « ${folder.projectName} », dans tous ses workspaces` : 'Projet : aucun projet reconnu pour le dossier du pane actif'}
              </label>
            </fieldset>
          )}
          <AccentSwatches presets={presets} value={value} fallback={inherited} fallbackLabel={inherited ? 'Couleur du projet' : 'Aucune'} onChange={handleColorChange} />
        </div>
        <div className="flex items-center justify-end border-t border-tily-line px-4 py-3">
          <button ref={closeRef} type="button" className={SETTINGS_PRIMARY} data-tip="Échap" onClick={closeColorDialog}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

export function ColorDialog() {
  const target = useAppearanceStore((store) => store.colorTarget)
  const workspace = useSessionStore((store) => (store.session && target ? findWorkspace(store.session, target.workspaceId) : undefined))
  const folder = useAppearanceStore((store) => (workspace ? store.projects[projectKey(workspacePath(workspace))] : undefined))
  const tab = target?.tabId ? workspace?.tabs.find((candidate) => candidate.id === target.tabId) : undefined
  if (!target || !workspace || (target.tabId && !tab)) {
    return null
  }
  return <ColorContent key={`${target.workspaceId}:${target.tabId ?? ''}`} workspace={workspace} tab={tab} folder={folder} />
}
