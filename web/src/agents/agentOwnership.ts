import { panesOf, type Session } from '../model/session'

export const OWNER_LABEL = 'créé par Claude'

const ownerLocation = (session: Session | null, owner: string): string | undefined => {
  for (const workspace of session?.workspaces ?? []) {
    const tab = workspace.tabs.find((candidate) => panesOf(candidate.tree).some((pane) => pane.id === owner))
    if (tab) {
      return `${workspace.name} › ${tab.name}`
    }
  }
  return undefined
}

export const ownerTip = (session: Session | null, owner: string): string => {
  const location = ownerLocation(session, owner)
  return location
    ? `Créé par Claude Code depuis « ${location} »`
    : 'Créé par Claude Code depuis un pane aujourd’hui fermé'
}
