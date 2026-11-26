import type { ShinyEncounter } from '../bridge/messages'
import { panesOf } from '../model/session'
import { useHostStore } from '../store/hostStore'
import { useSessionStore } from '../store/sessionStore'

const tabNameOf = (paneId: string): string | undefined =>
  useSessionStore
    .getState()
    .session?.workspaces.flatMap((workspace) => workspace.tabs)
    .find((tab) => panesOf(tab.tree).some((pane) => pane.id === paneId))?.name

const tallyOf = (total: number): string => (total === 1 ? 'le tout premier !' : `${total} rencontrés en tout.`)

const whoOf = (encounters: ShinyEncounter[]): string => {
  if (encounters.length > 1) {
    return `${encounters.length} compagnons chromatiques sont apparus`
  }
  return `${encounters[0].subagent ? 'Un sous-agent' : 'Un compagnon'} chromatique est apparu`
}

export const announceShinyCompanions = (encounters: ShinyEncounter[], total: number): void => {
  const tabs = [...new Set(encounters.map((encounter) => tabNameOf(encounter.pane)))]
  const place = tabs.length === 1 && tabs[0] ? ` dans « ${tabs[0]} »` : ''
  useHostStore.getState().setStatus(`✦ ${whoOf(encounters)}${place} : ${tallyOf(total)}`)
}
