import { leaderHintsOf } from '../keyboard/leaderHints'
import { useShortcutStore } from '../store/shortcutStore'

export function LeaderHints() {
  const settings = useShortcutStore((state) => state.settings)
  return (
    <div role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center text-xs">
      <span className="shrink-0 rounded bg-tily-focus px-2 py-0.5 font-semibold text-tily-terminal">Leader…</span>
      <ul className="absolute top-full left-3 z-40 mt-1 grid w-[min(860px,calc(100%-24px))] grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-4 gap-y-1 rounded-md border border-tily-line bg-tily-panel px-3 py-2 leading-[18px] text-tily-muted shadow-2xl">
        {leaderHintsOf(settings).map((hint) => (
          <li key={hint.keys} className="min-w-0 truncate">
            <kbd className="rounded border border-tily-line bg-tily-paper px-1 font-mono text-[11px] text-tily-ink">{hint.keys}</kbd> {hint.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
