import { useMemo } from 'react'
import type { Project } from '../bridge/messages'
import type { SearchItem } from '../palette/searchFilter'
import { SearchDialog } from './SearchDialog'
import { Command } from '../keyboard/commands'
import { shortcutText, withShortcut } from '../keyboard/shortcutLabels'

interface ProjectPickerProps {
  projects: Project[]
  root: string
  additionalRoots: string[]
  error: string | null
  onClose: () => void
  onSelect: (project: Project, inActiveWorkspace: boolean) => void
  onBrowse: (inActiveWorkspace: boolean) => void
}

interface ProjectItem extends SearchItem {
  project?: Project
}

const WORKTREE_HINT = 'worktree · '
export const PROJECTS_LOADING = 'Chargement des projets…'
const BROWSE_ITEM: ProjectItem = { id: 'parcourir', label: 'Parcourir…', hint: 'Choisir un autre dossier' }

const hintOf = (project: Project): string => (project.worktree ? `${WORKTREE_HINT}${project.path}` : project.path)

const emptyMessageOf = (projects: Project[], root: string, additionalRoots: string[], error: string | null): string => {
  if (projects.length > 0) {
    return 'Aucun dossier ne correspond à la recherche.'
  }
  if (error) {
    return error
  }
  if (root === '') {
    return PROJECTS_LOADING
  }
  const settings = withShortcut('Paramètres', shortcutText(Command.Settings))
  return additionalRoots.length === 0 ? `Aucun projet dans ${root} : le dossier des projets se change dans ${settings}.` : `Aucun projet dans les dossiers des projets : ils se changent dans ${settings}.`
}

export function ProjectPicker({ projects, root, additionalRoots, error, onClose, onSelect, onBrowse }: ProjectPickerProps) {
  const items = useMemo<ProjectItem[]>(() => projects.map((project) => ({ id: project.path, label: project.name, hint: hintOf(project), project })), [projects])
  const run = (item: ProjectItem, inActiveWorkspace: boolean) => (item.project ? onSelect(item.project, inActiveWorkspace) : onBrowse(inActiveWorkspace))
  const handleRun = (item: ProjectItem) => run(item, false)
  const handleRunInActiveWorkspace = (item: ProjectItem) => run(item, true)

  return (
    <SearchDialog
      label="Ouvrir un projet"
      placeholder={root && additionalRoots.length === 0 ? `Dossier dans ${root}…` : 'Dossier de projet…'}
      emptyMessage={emptyMessageOf(projects, root, additionalRoots, error)}
      items={items}
      lastItem={BROWSE_ITEM}
      notice={projects.length > 0 ? error : null}
      onClose={onClose}
      onRun={handleRun}
      onRunAlternate={handleRunInActiveWorkspace}
      footer="Entrée : nouveau workspace · Maj+Entrée : nouvel onglet dans le workspace actif"
    />
  )
}
