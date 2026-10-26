import { useMemo } from 'react'
import type { Project } from '../bridge/messages'
import type { SearchItem } from '../palette/searchFilter'
import { SearchDialog } from './SearchDialog'
import { Command } from '../keyboard/commands'
import { shortcutText, withShortcut } from '../keyboard/shortcutLabels'

interface ProjectPickerProps {
  projects: Project[]
  root: string
  error: string | null
  onClose: () => void
  onSelect: (project: Project, inActiveWorkspace: boolean) => void
}

interface ProjectItem extends SearchItem {
  project: Project
}

const WORKTREE_HINT = 'worktree · '
export const PROJECTS_LOADING = 'Chargement des projets…'

const hintOf = (project: Project): string => (project.worktree ? `${WORKTREE_HINT}${project.path}` : project.path)

export function ProjectPicker({ projects, root, error, onClose, onSelect }: ProjectPickerProps) {
  const items = useMemo<ProjectItem[]>(() => projects.map((project) => ({ id: project.path, label: project.name, hint: hintOf(project), project })), [projects])
  const handleRun = (item: ProjectItem) => onSelect(item.project, false)
  const handleRunInActiveWorkspace = (item: ProjectItem) => onSelect(item.project, true)

  return (
    <SearchDialog
      label="Ouvrir un projet"
      placeholder={root ? `Dossier dans ${root}…` : 'Dossier de projet…'}
      emptyMessage={error ?? (root === '' ? PROJECTS_LOADING : projects.length === 0 ? `Aucun projet dans ${root} : le dossier des projets se change dans ${withShortcut('Paramètres', shortcutText(Command.Settings))}.` : 'Aucun dossier ne correspond à la recherche.')}
      items={items}
      onClose={onClose}
      onRun={handleRun}
      onRunAlternate={handleRunInActiveWorkspace}
      footer="Entrée : nouveau workspace · Maj+Entrée : nouvel onglet dans le workspace actif"
    />
  )
}
