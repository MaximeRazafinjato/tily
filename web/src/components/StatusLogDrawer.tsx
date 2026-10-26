import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { StatusLevel } from '../store/hostStore'
import { useStatusLogStore } from '../store/statusLogStore'
import { clearStatusLog, closeStatusLog, copyStatusLog, entryFullDate, entryTime, levelLabel } from '../statusLog/statusLogActions'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { PANEL_HEADER_BUTTON, SECTION_TITLE } from './rightPanelStyles'
import { Command } from '../keyboard/commands'
import { useShortcutText } from '../keyboard/shortcutLabels'

export const STATUS_LOG_ID = 'status-log'

const BOTTOM_TOLERANCE_PX = 8
const TEXT_BUTTON = 'cursor-pointer rounded-md px-[8px] py-[3px] text-[11px] text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-tily-muted'

const LEVEL_CLASSES: Record<StatusLevel, string> = {
  [StatusLevel.Info]: 'text-tily-ink-soft',
  [StatusLevel.Warning]: 'text-tily-warning',
  [StatusLevel.Error]: 'text-tily-error',
}

const countLabel = (count: number): string => (count === 0 ? 'Aucun message' : count === 1 ? '1 message' : `${count} messages`)

export function StatusLogDrawer({ today }: { today: Date }) {
  const entries = useStatusLogStore((state) => state.entries)
  const logShortcut = useShortcutText(Command.ToggleStatusLog)
  const hideTip = `Masquer le journal (Échap${logShortcut ? `, ${logShortcut}` : ''})`
  const listRef = useRef<HTMLDivElement>(null)
  const pinnedToBottom = useRef(true)
  const [problemsOnly, setProblemsOnly] = useState(false)
  const numbered = entries.map((entry, position) => ({ entry, position }))
  const shown = problemsOnly ? numbered.filter(({ entry }) => entry.level !== StatusLevel.Info) : numbered
  const empty = entries.length === 0

  useLayoutEffect(() => {
    const list = listRef.current
    if (list && pinnedToBottom.current) {
      list.scrollTop = list.scrollHeight
    }
  }, [entries, problemsOnly])

  const handleScroll = () => {
    const list = listRef.current
    if (list) {
      pinnedToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight <= BOTTOM_TOLERANCE_PX
    }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeStatusLog()
    }
  }
  const handleCopy = () => {
    if (!empty) {
      copyStatusLog()
    }
  }
  const handleToggleProblems = () => setProblemsOnly((current) => !current)
  const handleClear = () => {
    if (!empty) {
      clearStatusLog()
    }
  }

  return (
    <section
      id={STATUS_LOG_ID}
      data-status-log=""
      aria-label="Journal de la barre de statut"
      className="absolute right-0 bottom-[24px] left-0 z-20 flex h-[260px] max-h-[50vh] flex-col border-t border-tily-line bg-tily-paper shadow-[0_-8px_24px_rgba(0,0,0,0.35)]"
      onKeyDown={handleKeyDown}
    >
      <div className="flex h-[32px] shrink-0 items-center gap-[6px] pr-[6px] pl-[12px]">
        <span className={SECTION_TITLE}>Journal</span>
        <span className="text-[11px] text-tily-muted">{problemsOnly ? `${shown.length} sur ${countLabel(entries.length)}` : countLabel(entries.length)}</span>
        <span className="flex-1" />
        <button type="button" className={`${TEXT_BUTTON} aria-pressed:bg-tily-green-soft aria-pressed:text-tily-green-deep`} aria-pressed={problemsOnly} data-tip={problemsOnly ? 'Afficher tous les messages' : 'N’afficher que les avertissements et les erreurs'} onClick={handleToggleProblems}>
          Avertissements et erreurs
        </button>
        <button type="button" className={TEXT_BUTTON} aria-disabled={empty} data-tip="Copier le journal" onClick={handleCopy}>
          Copier
        </button>
        <button type="button" className={TEXT_BUTTON} aria-disabled={empty} data-tip="Effacer le journal" onClick={handleClear}>
          Effacer
        </button>
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Masquer le journal" data-tip={hideTip} onClick={closeStatusLog}>
          <Icon name={IconName.Close} />
        </button>
      </div>
      <div ref={listRef} role="log" data-status-log-list="" tabIndex={0} aria-label="Messages" className="min-h-0 flex-1 overflow-y-auto px-[12px] pb-[8px] text-[11px] leading-[1.6]" onScroll={handleScroll}>
        {empty ? (
          <p className="font-sans text-[12px] text-tily-muted">Aucun message : ceux de la barre de statut s’afficheront ici.</p>
        ) : shown.length === 0 ? (
          <p className="font-sans text-[12px] text-tily-muted">Aucun avertissement ni erreur dans le journal.</p>
        ) : (
          <ol>
            {shown.map(({ entry, position }) => (
              <li key={`${entry.at}-${position}`} className="flex gap-[10px]">
                <time dateTime={entry.at} data-tip={entryFullDate(entry)} className="shrink-0 text-tily-muted tabular-nums">
                  {entryTime(entry, today)}
                </time>
                <span className={`w-[92px] shrink-0 ${LEVEL_CLASSES[entry.level]}`}>{levelLabel(entry.level)}</span>
                <span className={`min-w-0 break-words whitespace-pre-wrap ${entry.level === StatusLevel.Info ? 'text-tily-ink' : LEVEL_CLASSES[entry.level]}`}>{entry.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
