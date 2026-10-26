import type { KeyboardEvent } from 'react'
import { SETTINGS_SECTION_LABELS, SettingsSection, settingsTabId } from './settingsSections'

interface SettingsNavProps {
  section: SettingsSection
  panelId: string
  onSelect: (section: SettingsSection) => void
}

const SECTIONS = Object.values(SettingsSection)
const STEPS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }

export function SettingsNav({ section, panelId, onSelect }: SettingsNavProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[event.key]
    if (!step) {
      return
    }
    event.preventDefault()
    const next = SECTIONS[(SECTIONS.indexOf(section) + step + SECTIONS.length) % SECTIONS.length]
    onSelect(next)
    document.getElementById(settingsTabId(next))?.focus()
  }

  return (
    <div role="tablist" aria-orientation="vertical" aria-label="Sections des paramètres" className="flex w-[170px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-tily-line p-2" onKeyDown={handleKeyDown}>
      {SECTIONS.map((candidate) => {
        const selected = candidate === section
        const handleClick = () => onSelect(candidate)
        return (
          <button
            key={candidate}
            id={settingsTabId(candidate)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={`cursor-pointer rounded px-2.5 py-1.5 text-left text-[12px] ${selected ? 'bg-tily-green-soft text-tily-green-deep' : 'text-tily-ink-soft hover:bg-tily-green-hover hover:text-tily-ink'}`}
            onClick={handleClick}
          >
            {SETTINGS_SECTION_LABELS[candidate]}
          </button>
        )
      })}
    </div>
  )
}
