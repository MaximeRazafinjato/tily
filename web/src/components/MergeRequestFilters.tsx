import type { ChangeEvent, KeyboardEvent } from 'react'
import { MergeRequestStateFilter, type MergeRequest } from '../bridge/forgeMessages'
import { changeMergeRequestState, clearMergeRequestFilters, setMergeRequestText, toggleMergeRequestAssignee, toggleMergeRequestLabel } from '../forge/mergeRequestActions'
import { assigneeFacets, filterActive, labelFacets } from '../forge/mergeRequestFilter'
import { STATE_FILTER_LABELS } from '../forge/mergeRequestLabels'
import { useForgeStore } from '../store/forgeStore'
import { MergeRequestFacetButton } from './MergeRequestFacetButton'
import { GIT_INPUT } from './rightPanelStyles'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface MergeRequestFiltersProps {
  path: string
  items: MergeRequest[]
  currentUser: string | undefined
}

const STATES = [MergeRequestStateFilter.Open, MergeRequestStateFilter.Merged, MergeRequestStateFilter.Closed, MergeRequestStateFilter.All]

const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => setMergeRequestText(event.target.value)

const handleTextKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Escape' && event.currentTarget.value.length > 0) {
    event.stopPropagation()
    setMergeRequestText('')
  }
}

export function MergeRequestFilters({ path, items, currentUser }: MergeRequestFiltersProps) {
  const filter = useForgeStore((store) => store.filter)
  const labels = labelFacets(items, filter.labels).map((label) => ({ id: label, label }))
  const assignees = assigneeFacets(items, filter.assignees, currentUser).map((user) => ({
    id: user.login,
    label: user.login === currentUser ? `Moi (${user.name})` : user.name,
  }))

  return (
    <div className="flex flex-col gap-[4px] px-[10px] pb-[4px]">
      <div className="flex flex-wrap gap-[2px]" role="group" aria-label="État">
        {STATES.map((state) => {
          const handleSelect = () => changeMergeRequestState(path, state)
          const pressed = filter.state === state
          return (
            <button
              key={state}
              type="button"
              aria-pressed={pressed}
              className={`h-[22px] cursor-pointer rounded px-[6px] text-[11px] ${pressed ? 'bg-tily-green-soft text-tily-green-deep' : 'text-tily-ink-soft hover:bg-tily-green-hover'}`}
              onClick={handleSelect}
            >
              {STATE_FILTER_LABELS[state]}
            </button>
          )
        })}
      </div>
      <input
        type="search"
        className={GIT_INPUT}
        value={filter.text}
        placeholder="Rechercher : titre, numéro, auteur, branche"
        aria-label="Rechercher dans les MR/PR"
        onChange={handleTextChange}
        onKeyDown={handleTextKeyDown}
      />
      <div className="flex flex-wrap items-center gap-[4px]">
        <MergeRequestFacetButton label="Labels" options={labels} selected={filter.labels} emptyMessage="Aucun label dans la liste" onToggle={toggleMergeRequestLabel} />
        <MergeRequestFacetButton label="Assignés" options={assignees} selected={filter.assignees} emptyMessage="Aucun assigné dans la liste" onToggle={toggleMergeRequestAssignee} />
        {filterActive(filter) && (
          <button type="button" className="flex size-[22px] cursor-pointer items-center justify-center rounded text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink" aria-label="Effacer les filtres" data-tip="Effacer les filtres" onClick={clearMergeRequestFilters}>
            <Icon name={IconName.Close} />
          </button>
        )}
      </div>
    </div>
  )
}
