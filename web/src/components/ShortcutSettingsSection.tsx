import { useState, type ChangeEvent } from 'react'
import type { ShortcutSettings } from '../bridge/messages'
import { COMMAND_GROUPS, type CommandEntry } from '../keyboard/commandCatalog'
import { chordOf } from '../keyboard/keyChords'
import { assignLeader, assignShortcut, isDefaultBinding, resetCommand, type ShortcutChange, type ShortcutFeedback } from '../keyboard/shortcutDraft'
import { MAX_LEADER_TIMEOUT_SECONDS, MIN_LEADER_TIMEOUT_SECONDS } from '../keyboard/shortcutRules'
import { normalize } from '../palette/searchFilter'
import type { ShortcutField } from '../store/shortcutStore'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { ShortcutCapture } from './ShortcutCapture'
import { ShortcutNotice } from './ShortcutNotice'
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
const LEADER_TARGET = 'leader'
const ALL_TARGET = 'all'

interface TargetedFeedback extends ShortcutFeedback {
  target: string
}

export function ShortcutSettingsSection({ title, shortcuts, defaults, onChange }: ShortcutSettingsSectionProps) {
  const [filter, setFilter] = useState('')
  const [feedback, setFeedback] = useState<TargetedFeedback | null>(null)
  const apply = (target: string, { shortcuts: changed, notice, error }: ShortcutChange) => {
    setFeedback(notice || error ? { target, notice, error } : null)
    if (!error) {
      onChange(changed)
    }
  }
  const feedbackOf = (target: string): ShortcutFeedback | null => (feedback?.target === target ? feedback : null)
  const handleAssign = (entry: CommandEntry, field: ShortcutField, chord: string) => apply(entry.command, assignShortcut(shortcuts, entry.command, field, chord))
  const handleReset = (entry: CommandEntry) => apply(entry.command, resetCommand(shortcuts, defaults, entry.command))
  const handleLeader = (chord: string) => apply(LEADER_TARGET, assignLeader(shortcuts, chord))
  const handleResetAll = () => apply(ALL_TARGET, { shortcuts: structuredClone(defaults), notice: 'Raccourcis par défaut rétablis : Enregistrer pour les appliquer.', error: null })
  const leaderFeedback = feedbackOf(LEADER_TARGET)
  const allFeedback = feedbackOf(ALL_TARGET)
  const handleTimeoutChange = (event: ChangeEvent<HTMLSelectElement>) => onChange({ ...shortcuts, leaderTimeoutSeconds: Number(event.target.value) })
  const handleFilterChange = (event: ChangeEvent<HTMLInputElement>) => setFilter(event.target.value)
  const query = normalize(filter.trim())
  const groups = COMMAND_GROUPS.map((group) => ({ ...group, entries: group.entries.filter((entry) => normalize(entry.label).includes(query)) })).filter((group) => group.entries.length > 0)

  return (
    <SettingsPanel
      title={title}
      grid={false}
      tip="Cliquez sur un raccourci puis appuyez sur la combinaison voulue ; Échap annule. Un raccourci déjà pris passe à la nouvelle commande. Un raccourci direct passe par Ctrl ou Alt ; une combinaison qui sert au terminal est acceptée avec un avertissement qui dit ce qu’elle n’y fera plus ; après le Leader, une touche seule, avec Maj au besoin."
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
        {leaderFeedback && <ShortcutNotice feedback={leaderFeedback} className="col-span-4" />}
      </div>
      <span className="flex gap-2">
        <input id={FILTER_ID} type="search" className={SETTINGS_INPUT} value={filter} placeholder="Filtrer les commandes…" aria-label="Filtrer les commandes" spellCheck={false} onChange={handleFilterChange} />
        <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={RESET_ALL} data-tip={RESET_ALL} onClick={handleResetAll}>
          <Icon name={IconName.Undo} />
        </button>
      </span>
      {allFeedback && <ShortcutNotice feedback={allFeedback} />}
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
              <ShortcutRow key={entry.command} entry={entry} binding={shortcuts.bindings[entry.command] ?? { direct: '', leader: '' }} isDefault={isDefaultBinding(shortcuts, defaults, entry.command)} feedback={feedbackOf(entry.command)} onAssign={handleAssign} onReset={handleReset} />
            ))}
          </ul>
        </div>
      ))}
      {groups.length === 0 && <p className={SETTINGS_HINT}>Aucune commande ne correspond.</p>}
    </SettingsPanel>
  )
}
