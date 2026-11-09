import { useShallow } from 'zustand/react/shallow'
import { browseProjectFolder, closeProjectPicker, selectProject } from '../project/projectOpenActions'
import { useHostStore } from '../store/hostStore'
import { useProjectOpenStore } from '../store/projectOpenStore'
import { ProjectPicker } from './ProjectPicker'
import { ProjectRepositoryPicker } from './ProjectRepositoryPicker'

export function ProjectPickers() {
  const choice = useProjectOpenStore((state) => state.choice)
  const { projects, projectsRoot, projectsAdditionalRoots, projectsError } = useHostStore(useShallow((state) => ({ projects: state.projects, projectsRoot: state.projectsRoot, projectsAdditionalRoots: state.projectsAdditionalRoots, projectsError: state.projectsError })))

  if (choice?.sources) {
    return <ProjectRepositoryPicker choice={choice} repositories={choice.sources.repositories} defaultRepository={choice.sources.defaultRepository} />
  }
  return <ProjectPicker projects={projects} root={projectsRoot} additionalRoots={projectsAdditionalRoots} error={projectsError} onClose={closeProjectPicker} onSelect={selectProject} onBrowse={browseProjectFolder} />
}
