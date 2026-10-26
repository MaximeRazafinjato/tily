import type { ChangeEvent, KeyboardEvent } from 'react'
import type { MergeRequest } from '../bridge/forgeMessages'
import { clearMergeRequestFilters, setMergeRequestText, toggleMergeRequestAssignee, toggleMergeRequestLabel } from '../forge/mergeRequestActions'
import { assigneeFacets, filterActive, labelFacets } from '../forge/mergeRequestFilter'
import { useForgeStore } from '../store/forgeStore'
import { MergeRequestFacetButton } from './MergeRequestFacetButton'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface MergeRequestFiltersProps {
  items: MergeRequest[]
  currentUser: string | undefined
}

const SEARCH_INPUT =
  'h-[24px] min-w-[100px] flex-1 rounded border border-tily-line bg-tily-panel px-2 text-[12px] text-tily-ink outline-none placeholder:text-tily-muted focus:border-tily-focus'

const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => setMergeRequestText(event.target.value)

const handleTextKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Escape' && event.currentTarget.value.length > 0) {
    event.stopPropagation()
    setMergeRequestText('')
  }
}

export function MergeRequestFilters({ items, currentUser }: MergeRequestFiltersProps) {
  const filter = useForgeStore((store) => store.filter)
  const labels = labelFacets(items, filter.labels).map((label) => ({ id: label, label }))
  const assignees = assigneeFacets(items, filter.assignees, currentUser).map((user) => ({
    id: user.login,
    label: user.login === currentUser ? `Moi (${user.name})` : user.name,
  }))

  return (
    <div className="mx-[10px] flex flex-wrap items-center gap-[4px] border-b border-tily-line pb-[8px]">
      <input
        type="search"
        className={SEARCH_INPUT}
        value={filter.text}
        placeholder="Rechercher"
        aria-label="Rechercher dans les MR/PR"
        data-tip="Titre, numéro, auteur ou branche"
        onChange={handleTextChange}
        onKeyDown={handleTextKeyDown}
      />
      <MergeRequestFacetButton label="Labels" options={labels} selected={filter.labels} emptyMessage="Aucun label dans la liste" onToggle={toggleMergeRequestLabel} />
      <MergeRequestFacetButton label="Assignés" options={assignees} selected={filter.assignees} emptyMessage="Aucun assigné dans la liste" onToggle={toggleMergeRequestAssignee} />
      {filterActive(filter) && (
        <button type="button" className="flex size-[24px] cursor-pointer items-center justify-center rounded text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink" aria-label="Effacer les filtres" data-tip="Effacer les filtres" onClick={clearMergeRequestFilters}>
          <Icon name={IconName.Close} />
        </button>
      )}
    </div>
  )
}
