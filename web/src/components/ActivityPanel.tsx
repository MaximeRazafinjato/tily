import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { bridge } from '../bridge/bridge'
import { byCategory, CATEGORY_LABELS, formatUsage, HOST_CATEGORIES, HOST_ROW_ID, PANE_CATEGORIES, ramShare, tabUsages, usageOf } from '../activity/activityView'
import { ProcessCategory, type ProcessUsage } from '../bridge/activityMessages'
import type { Session } from '../model/session'
import { useActivityStore } from '../store/activityStore'
import { usePageVisible } from './usePageVisible'
import { ActivityRow } from './ActivityRow'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface ActivityPanelProps {
  session: Session
}

function UsageLine({ label, value, detail = false }: { label: string; value: string; detail?: boolean }) {
  return (
    <div className={`flex items-baseline gap-[6px] ${detail ? 'pl-[12px] text-[11px] text-tily-muted' : ''}`}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-tily-muted tabular-nums">{value}</span>
    </div>
  )
}

const COUNTED_CATEGORIES = [ProcessCategory.WebView, ProcessCategory.BrowserPages, ProcessCategory.Other]

const countedLabel = (label: string, count: number): string => (count > 1 ? `${label} (${count})` : label)

function CategoryLines({ processes, categories }: { processes: ProcessUsage[]; categories: ProcessCategory[] }) {
  return byCategory(processes, categories).map(({ category, usage, names }) => (
    <div key={category}>
      <UsageLine label={COUNTED_CATEGORIES.includes(category) ? `${CATEGORY_LABELS[category]} (${usage.count})` : CATEGORY_LABELS[category]} value={formatUsage(usage)} />
      {names.map(({ name, usage: nameUsage }) => (
        <UsageLine key={name} detail label={countedLabel(name, nameUsage.count)} value={formatUsage(nameUsage)} />
      ))}
    </div>
  ))
}

export function ActivityPanel({ session }: ActivityPanelProps) {
  const { expanded, open, panes, host } = useActivityStore(useShallow((state) => ({ expanded: state.expanded, open: state.open, panes: state.panes, host: state.host })))
  const toggleExpanded = useActivityStore((state) => state.toggleExpanded)
  const toggleOpen = useActivityStore((state) => state.toggleOpen)
  const pageVisible = usePageVisible()

  useEffect(() => {
    if (!pageVisible) {
      return
    }
    bridge.send({ type: 'activity.subscribe' })
    return () => bridge.send({ type: 'activity.unsubscribe' })
  }, [pageVisible])

  const tabs = useMemo(() => tabUsages(session, panes), [session, panes])
  const total = useMemo(() => usageOf([...host, ...tabs.flatMap((tab) => tab.processes)]), [host, tabs])
  const hostUsage = useMemo(() => usageOf(host), [host])

  return (
    <section className={`shrink-0 border-t border-tily-line px-[8px] ${expanded ? 'pb-[8px]' : ''}`} aria-label="Activité">
      <button type="button" aria-expanded={expanded} className="flex h-[32px] w-full cursor-pointer items-center gap-[6px] px-[4px] text-[11px] font-semibold tracking-[0.06em] text-tily-muted uppercase hover:text-tily-ink" onClick={toggleExpanded}>
        <Icon name={IconName.Chevron} size={10} className={`transition-transform duration-[120ms] ease-out ${expanded ? 'rotate-90' : ''}`} />
        <span>Activité</span>
        {total.count > 0 && <span className="flex-1 text-right font-normal tracking-normal normal-case tabular-nums">{formatUsage(total)}</span>}
      </button>
      {expanded && (
        <div className="max-h-[40vh] overflow-auto">
          {total.count === 0 && <p className="px-[4px] text-[11px] text-tily-muted">Mesure en cours…</p>}
          {hostUsage.count > 0 && (
            <ActivityRow label="Interface Tily" usage={hostUsage} share={ramShare(hostUsage, total)} open={open.includes(HOST_ROW_ID)} onToggle={() => toggleOpen(HOST_ROW_ID)}>
              <CategoryLines processes={host} categories={HOST_CATEGORIES} />
            </ActivityRow>
          )}
          {tabs.map((tab) => (
            <ActivityRow
              key={tab.id}
              label={
                <>
                  <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-tily-muted" style={tab.color ? { backgroundColor: tab.color } : undefined} />
                  <span className="truncate">{tab.label}</span>
                </>
              }
              usage={tab.usage}
              share={ramShare(tab.usage, total)}
              open={open.includes(tab.id)}
              onToggle={() => toggleOpen(tab.id)}
            >
              <CategoryLines processes={tab.processes} categories={PANE_CATEGORIES} />
            </ActivityRow>
          ))}
        </div>
      )}
    </section>
  )
}
