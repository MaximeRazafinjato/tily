import type { ShortcutBinding } from '../bridge/messages'
import type { CommandEntry } from '../keyboard/commandCatalog'
import { chordOf, leaderKeyOf } from '../keyboard/keyChords'
import { ShortcutField } from '../store/shortcutStore'
import { ShortcutCapture } from './ShortcutCapture'
import { SETTINGS_LABEL } from './settingsStyles'

interface ShortcutRowProps {
  entry: CommandEntry
  binding: ShortcutBinding
  isDefault: boolean
  onAssign: (entry: CommandEntry, field: ShortcutField, chord: string) => void
  onReset: (entry: CommandEntry) => void
}

const RESET = 'w-5 shrink-0 cursor-pointer rounded text-[12px] text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink'

const readLeaderKey = (event: KeyboardEvent): string | null => (event.ctrlKey || event.altKey ? chordOf(event) : leaderKeyOf(event))

export function ShortcutRow({ entry, binding, isDefault, onAssign, onReset }: ShortcutRowProps) {
  const handleDirect = (chord: string) => onAssign(entry, ShortcutField.Direct, chord)
  const handleLeader = (chord: string) => onAssign(entry, ShortcutField.Leader, chord)
  const handleClearDirect = () => onAssign(entry, ShortcutField.Direct, '')
  const handleClearLeader = () => onAssign(entry, ShortcutField.Leader, '')
  const handleReset = () => onReset(entry)

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_150px_150px_20px] items-center gap-2">
      <span className={`${SETTINGS_LABEL} truncate`} title={entry.label}>
        {entry.label}
      </span>
      <ShortcutCapture chord={binding.direct} label={`Raccourci direct de « ${entry.label} »`} read={chordOf} onCapture={handleDirect} onClear={handleClearDirect} />
      <ShortcutCapture chord={binding.leader} label={`Touche après le Leader pour « ${entry.label} »`} read={readLeaderKey} onCapture={handleLeader} onClear={handleClearLeader} />
      {isDefault ? (
        <span />
      ) : (
        <button type="button" className={RESET} aria-label={`Rétablir les raccourcis de « ${entry.label} »`} data-tip="Rétablir les raccourcis par défaut" onClick={handleReset}>
          ↺
        </button>
      )}
    </li>
  )
}
