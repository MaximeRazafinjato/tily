import { useMemo } from 'react'
import type { SearchItem } from '../palette/searchFilter'
import { browseProjectRepository, closeProjectPicker, openProjectRepository } from '../project/projectOpenActions'
import type { ProjectChoice } from '../store/projectOpenStore'
import { repositoryLabel, sameFolder } from '../worktree/worktreePaths'
import { SearchDialog } from './SearchDialog'

interface ProjectRepositoryPickerProps {
  choice: ProjectChoice
  repositories: string[]
  defaultRepository?: string
}

interface RepositoryItem extends SearchItem {
  repository?: string
}

const BROWSE_ID = 'parcourir'
const DEFAULT_HINT = 'par défaut · '
const FOOTER = 'Entrée : ouvrir · Maj+Entrée : nouvel onglet dans le workspace actif · Ctrl+Entrée : ouvrir et utiliser par défaut pour ce projet'

const run = (item: RepositoryItem, inActiveWorkspace: boolean, remember: boolean): void => {
  if (item.repository) {
    openProjectRepository(item.repository, inActiveWorkspace, remember)
  } else {
    browseProjectRepository(inActiveWorkspace, remember)
  }
}

export function ProjectRepositoryPicker({ choice, repositories, defaultRepository }: ProjectRepositoryPickerProps) {
  const items = useMemo<RepositoryItem[]>(() => {
    const isDefault = (repository: string) => sameFolder(repository, defaultRepository ?? '')
    const ordered = [...repositories.filter(isDefault), ...repositories.filter((repository) => !isDefault(repository))]
    return [
      ...ordered.map((repository) => ({ id: repository, label: repositoryLabel(repository, choice.project.path), hint: isDefault(repository) ? `${DEFAULT_HINT}${repository}` : repository, repository })),
      { id: BROWSE_ID, label: 'Parcourir…', hint: 'Choisir un autre dossier' },
    ]
  }, [repositories, defaultRepository, choice.project.path])
  const handleRun = (item: RepositoryItem) => run(item, choice.inActiveWorkspace, false)
  const handleRunInActiveWorkspace = (item: RepositoryItem) => run(item, true, false)
  const handleRunAndRemember = (item: RepositoryItem) => run(item, choice.inActiveWorkspace, true)

  return (
    <SearchDialog
      label={`Ouvrir le projet « ${choice.project.name} »`}
      placeholder={`Dépôt de ${choice.project.name}…`}
      emptyMessage="Aucun dépôt ne correspond à la recherche."
      items={items}
      onClose={closeProjectPicker}
      onRun={handleRun}
      onRunAlternate={handleRunInActiveWorkspace}
      onRunControl={handleRunAndRemember}
      footer={FOOTER}
    />
  )
}
