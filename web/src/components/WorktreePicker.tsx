import { useMemo } from 'react'
import type { Project } from '../bridge/messages'
import type { SearchItem } from '../palette/searchFilter'
import { WorktreePickerKind } from '../store/worktreeStore'
import { PROJECTS_LOADING } from './ProjectPicker'
import { SearchDialog } from './SearchDialog'

interface WorktreePickerProps {
  kind: WorktreePickerKind
  projects: Project[]
  root: string
  error: string | null
  onClose: () => void
  onSelect: (kind: WorktreePickerKind, project: Project, inActiveWorkspace: boolean) => void
}

interface ProjectItem extends SearchItem {
  project: Project
}

const OPEN_FOOTER = 'Entrée : nouveau workspace (ou terminal déjà ouvert) · Maj+Entrée : nouvel onglet dans le workspace actif'

const LABELS: Record<WorktreePickerKind, { label: string; placeholder: string; empty: string }> = {
  [WorktreePickerKind.Source]: { label: 'Créer un worktree depuis…', placeholder: 'Projet source du worktree…', empty: 'Aucun projet trouvé.' },
  [WorktreePickerKind.Open]: { label: 'Ouvrir un worktree', placeholder: 'Worktree à ouvrir…', empty: 'Aucun worktree trouvé.' },
}

export function WorktreePicker({ kind, projects, root, error, onClose, onSelect }: WorktreePickerProps) {
  const wanted = kind === WorktreePickerKind.Open
  const items = useMemo<ProjectItem[]>(
    () => projects.filter((project) => project.worktree === wanted).map((project) => ({ id: project.path, label: project.name, hint: project.path, project })),
    [projects, wanted],
  )
  const { label, placeholder, empty } = LABELS[kind]
  const handleRun = (item: ProjectItem) => onSelect(kind, item.project, false)
  const handleRunInActiveWorkspace = (item: ProjectItem) => onSelect(kind, item.project, true)

  return <SearchDialog label={label} placeholder={root ? `${placeholder} (${root})` : placeholder} emptyMessage={error ?? (root === '' ? PROJECTS_LOADING : empty)} items={items} onClose={onClose} onRun={handleRun} onRunAlternate={wanted ? handleRunInActiveWorkspace : undefined} footer={wanted ? OPEN_FOOTER : undefined} />
}
