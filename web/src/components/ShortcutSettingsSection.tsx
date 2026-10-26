import { useState, type ChangeEvent } from 'react'
import type { ShortcutSettings } from '../bridge/messages'
import { COMMAND_GROUPS, type CommandEntry } from '../keyboard/commandCatalog'
import { chordOf } from '../keyboard/keyChords'
import { assignLeader, assignShortcut, isDefaultBinding, resetCommand, type ShortcutChange } from '../keyboard/shortcutDraft'
import { MAX_LEADER_TIMEOUT_SECONDS, MIN_LEADER_TIMEOUT_SECONDS } from '../keyboard/shortcutRules'
import { normalize } from '../palette/searchFilter'
import type { ShortcutField } from '../store/shortcutStore'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { ShortcutCapture } from './ShortcutCapture'
import { ShortcutRow } from './ShortcutRow'
import { SettingsPanel } from './SettingsPanel'
import { SETTINGS_HINT, SETTINGS_ICON_BUTTON, SETTINGS_INPUT, SETTINGS_LABEL } from './settingsStyles'

interface ShortcutSettingsSectionProps {
  title: string
  shortcuts: ShortcutSettings
  defaults: ShortcutSettings
  onChange: (shortcuts: ShortcutSettings) => void
}

const LEADER_TIMEOUTS = Array.from({ length: MAX_LEADER_TIMEOUT_SECONDS - MIN_LEADER_TIMEOUT_SECONDS + 1 }, (_, index) => MIN_LEADER_TIMEOUT_SECONDS + index)
const FILTER_ID = 'settings-shortcut-filter'
const TIMEOUT_ID = 'settings-leader-timeout'
const COLUMN = 'text-[11px] text-tily-muted'
const GROUP_TITLE = 'mt-2 text-[11px] font-semibold tracking-wide text-tily-muted uppercase'
const RESET_ALL = 'Rétablir tous les raccourcis par défaut'

export function ShortcutSettingsSection({ title, shortcuts, defaults, onChange }: ShortcutSettingsSectionProps) {
  const [filter, setFilter] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const apply = (change: ShortcutChange) => {
    setNotice(change.notice)
    setError(change.error)
    if (!change.error) {
      onChange(change.shortcuts)
    }
  }
  const handleAssign = (entry: CommandEntry, field: ShortcutField, chord: string) => apply(assignShortcut(shortcuts, entry.command, field, chord))
  const handleReset = (entry: CommandEntry) => apply(resetCommand(shortcuts, defaults, entry.command))
  const handleLeader = (chord: string) => apply(assignLeader(shortcuts, chord))
  const handleResetAll = () => apply({ shortcuts: structuredClone(defaults), notice: 'Raccourcis par défaut rétablis : Enregistrer pour les appliquer.', error: null })
  const handleTimeoutChange = (event: ChangeEvent<HTMLSelectElement>) => onChange({ ...shortcuts, leaderTimeoutSeconds: Number(event.target.value) })
  const handleFilterChange = (event: ChangeEvent<HTMLInputElement>) => setFilter(event.target.value)
  const query = normalize(filter.trim())
  const groups = COMMAND_GROUPS.map((group) => ({ ...group, entries: group.entries.filter((entry) => normalize(entry.label).includes(query)) })).filter((group) => group.entries.length > 0)

  return (
    <SettingsPanel
      title={title}
      grid={false}
      tip="Cliquez sur un raccourci puis appuyez sur la combinaison voulue ; Échap annule. Un raccourci déjà pris passe à la nouvelle commande. Un raccourci direct passe par Ctrl ou Alt (Ctrl+lettre seule reste au shell, sauf Ctrl+P) ; après le Leader, une touche seule, avec Maj au besoin."
    >
      <div className="grid grid-cols-[minmax(0,1fr)_150px_150px_20px] items-baseline gap-2">
        <span className={SETTINGS_LABEL}>Touche Leader</span>
        <ShortcutCapture chord={shortcuts.leader} label="Touche Leader" read={chordOf} onCapture={handleLeader} />
        <select id={TIMEOUT_ID} className={SETTINGS_INPUT} aria-label="Délai du Leader" data-tip="Délai d’expiration du Leader" value={shortcuts.leaderTimeoutSeconds} onChange={handleTimeoutChange}>
          {LEADER_TIMEOUTS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {`${seconds} s${seconds === defaults.leaderTimeoutSeconds ? ' (défaut)' : ''}`}
            </option>
          ))}
        </select>
        <span />
      </div>
      <span className="flex gap-2">
        <input id={FILTER_ID} type="search" className={SETTINGS_INPUT} value={filter} placeholder="Filtrer les commandes…" aria-label="Filtrer les commandes" spellCheck={false} onChange={handleFilterChange} />
        <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={RESET_ALL} data-tip={RESET_ALL} onClick={handleResetAll}>
          <Icon name={IconName.Undo} />
        </button>
      </span>
      <p role="status" className={error ? 'text-[11px] text-tily-error' : SETTINGS_HINT}>
        {error ?? notice ?? ''}
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_150px_150px_20px] gap-2">
        <span className={COLUMN}>Commande</span>
        <span className={COLUMN}>Raccourci direct</span>
        <span className={COLUMN}>Après le Leader</span>
      </div>
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <h4 className={GROUP_TITLE}>{group.title}</h4>
          <ul className="flex flex-col gap-1">
            {group.entries.map((entry) => (
              <ShortcutRow key={entry.command} entry={entry} binding={shortcuts.bindings[entry.command] ?? { direct: '', leader: '' }} isDefault={isDefaultBinding(shortcuts, defaults, entry.command)} onAssign={handleAssign} onReset={handleReset} />
            ))}
          </ul>
        </div>
      ))}
      {groups.length === 0 && <p className={SETTINGS_HINT}>Aucune commande ne correspond.</p>}
    </SettingsPanel>
  )
}
