import { useMemo } from 'react'
import { activeTab, activeWorkspace } from '../model/session'
import type { SearchItem } from '../palette/searchFilter'
import { useSessionStore } from '../store/sessionStore'
import { useTabMergePickerStore } from '../store/tabMergePickerStore'
import { closeTabMergePicker, mergeActiveTabInto, tabMergeTargets, type TabMergeTarget } from '../terminal/tabMerge'
import { SearchDialog } from './SearchDialog'

interface MergeItem extends SearchItem {
  target: TabMergeTarget
}

const handleRun = (item: MergeItem) => mergeActiveTabInto(item.target)

export function TabMergePicker() {
  const open = useTabMergePickerStore((state) => state.open)
  const session = useSessionStore((state) => state.session)
  const items = useMemo<MergeItem[]>(() => {
    const workspace = open && session ? activeWorkspace(session) : undefined
    if (!session || !workspace) {
      return []
    }
    return tabMergeTargets(session, activeTab(workspace).id).map((target) => ({ id: `${target.placement}-${target.tab.id}`, label: `${target.name}, ${target.placementLabel}`, target }))
  }, [open, session])
  if (!open) {
    return null
  }

  return <SearchDialog label="Fusionner l’onglet actif dans un autre onglet" placeholder="Onglet qui recevra l’onglet actif…" emptyMessage="Aucun onglet ne correspond à la recherche." items={items} onClose={closeTabMergePicker} onRun={handleRun} />
}
