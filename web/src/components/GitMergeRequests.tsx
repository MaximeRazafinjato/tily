import { useEffect, type MouseEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ForgeKind, type ForgeRemote, type MergeRequest } from '../bridge/forgeMessages'
import { listMergeRequests, openMergeRequest, refreshMergeRequests, requestBranchMergeRequests, toggleMergeRequests } from '../forge/mergeRequestActions'
import { filterActive, filterMergeRequests } from '../forge/mergeRequestFilter'
import { kindNoun, MERGE_REQUEST_LINK_HINT, sectionTitle, STATE_FILTER_LABELS } from '../forge/mergeRequestLabels'
import { branchKey, useForgeStore } from '../store/forgeStore'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { MergeRequestFilters } from './MergeRequestFilters'
import { MergeRequestPill } from './MergeRequestPill'
import { MergeRequestRow } from './MergeRequestRow'
import { PANEL_HEADER_BUTTON } from './rightPanelStyles'
import { Spinner } from './Spinner'

interface GitMergeRequestsProps {
  root: string
  branch: string | null
}

const listPageOf = (forge: ForgeRemote): string => `${forge.webUrl}${forge.kind === ForgeKind.GitHub ? '/pulls' : '/-/merge_requests'}`

const currentFirst = (items: MergeRequest[], branch: string | null): MergeRequest[] =>
  branch ? [...items.filter((item) => item.sourceBranch === branch), ...items.filter((item) => item.sourceBranch !== branch)] : items

export function GitMergeRequests({ root, branch }: GitMergeRequestsProps) {
  const { expanded, listing, filter } = useForgeStore(useShallow((store) => ({ expanded: store.expanded, listing: store.listing, filter: store.filter })))
  const branchResult = useForgeStore((store) => (branch ? store.branches[branchKey(root, branch)] : undefined))

  useEffect(() => {
    if (branch) {
      requestBranchMergeRequests(root, branch)
    }
  }, [root, branch])
  useEffect(() => {
    if (expanded) {
      listMergeRequests(root)
    }
  }, [expanded, root])

  const current = listing && listing.path.toLowerCase() === root.toLowerCase() ? listing : null
  const list = current?.list ?? null
  const forge = list?.forge ?? branchResult?.forge
  const noun = kindNoun(forge?.kind)
  const items = list ? currentFirst(filterMergeRequests(list.items, filter), branch) : []
  const error = current?.error ?? (list ? null : (branchResult?.error ?? null))
  const count = list ? (filterActive(filter) ? `${items.length}/${list.items.length}` : `${list.items.length}${list.truncated ? '+' : ''}`) : ''
  const handleRefresh = () => refreshMergeRequests(root, branch)
  const handleOpenList = (event: MouseEvent) => {
    if (forge) {
      openMergeRequest(listPageOf(forge), event.shiftKey)
    }
  }
  const emptyMessage = filterActive(filter)
    ? `Aucune ${noun} ne correspond aux filtres.`
    : `Aucune ${noun} (${STATE_FILTER_LABELS[filter.state].toLowerCase()}).`

  return (
    <div className="flex max-h-[45%] shrink-0 flex-col border-t border-tily-line">
      <div className="flex h-[28px] shrink-0 items-center gap-[6px] pr-[6px] pl-[6px]">
        <button
          type="button"
          aria-expanded={expanded}
          className="flex min-w-0 cursor-pointer items-center gap-[4px] rounded text-left text-[11px] font-semibold tracking-[0.06em] text-tily-muted uppercase hover:text-tily-ink"
          onClick={toggleMergeRequests}
        >
          <Icon name={IconName.Chevron} size={10} className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          <span className="truncate">{sectionTitle(forge?.kind)}</span>
          <span className="shrink-0 text-[11px] font-normal tracking-normal normal-case">{count}</span>
        </button>
        {current?.loading && <Spinner />}
        <span className="ml-auto" />
        {branch && <MergeRequestPill path={root} branch={branch} className="min-w-0 text-[11px]" />}
        <button type="button" className={PANEL_HEADER_BUTTON} data-tip={`Actualiser les ${noun}`} aria-label={`Actualiser les ${noun}`} onClick={handleRefresh}>
          <Icon name={IconName.Refresh} />
        </button>
      </div>
      {expanded && (
        <div className="flex min-h-0 flex-col">
          {error && <p className="px-[12px] pb-[6px] text-[12px] break-words text-tily-error">{error}</p>}
          {list && (
            <>
              <MergeRequestFilters path={root} items={list.items} currentUser={list.currentUser} />
              <div className="min-h-0 overflow-y-auto px-[2px] pb-[4px]" role="list" aria-label={sectionTitle(forge?.kind)}>
                {items.length === 0 ? (
                  <p className="px-[10px] py-[4px] text-[12px] text-tily-muted italic">{emptyMessage}</p>
                ) : (
                  items.map((item) => (
                    <div key={item.number} role="listitem">
                      <MergeRequestRow item={item} current={item.sourceBranch === branch} />
                    </div>
                  ))
                )}
                {list.truncated && <p className="px-[10px] py-[4px] text-[11px] text-tily-muted">{`Seules les ${list.items.length} ${noun} les plus récentes sont chargées.`}</p>}
              </div>
              {forge && (
                <button type="button" className="mx-[10px] mb-[6px] cursor-pointer self-start text-[11px] text-tily-muted hover:text-tily-ink hover:underline" data-tip={MERGE_REQUEST_LINK_HINT} onClick={handleOpenList}>
                  {`Toutes les ${noun} sur ${forge.host}`}
                </button>
              )}
            </>
          )}
          {!list && !error && current?.loading && <p className="px-[12px] pb-[6px] text-[12px] text-tily-muted">{`Lecture des ${noun}…`}</p>}
        </div>
      )}
    </div>
  )
}
