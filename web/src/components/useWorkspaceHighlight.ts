import { workspacePath } from '../appearance/appearanceActions'
import type { Workspace } from '../model/session'
import { projectKey, useAppearanceStore } from '../store/appearanceStore'

export const useWorkspaceHighlight = (workspace: Workspace): string | undefined => {
  const projectColor = useAppearanceStore((store) => store.projects[projectKey(workspacePath(workspace))]?.color)
  return workspace.color ?? projectColor
}
