import type { ReleaseHistoryEntry } from '../bridge/updateMessages'
import { formatDate, openReleaseHistoryPage } from '../update/updateActions'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { ReleaseNote } from './ReleaseNote'
import { ReleaseNoteList } from './ReleaseNoteList'
import { SETTINGS_HINT, SETTINGS_ICON_BUTTON } from './settingsStyles'

interface ReleaseHistoryItemProps {
  entry: ReleaseHistoryEntry
  installed: boolean
  expanded: boolean
  onToggle: (version: string) => void
}

const BADGE = 'rounded-full border px-1.5 text-[11px] leading-[16px]'
const SECTION_TITLE = 'text-[11px] font-semibold tracking-wide text-tily-muted uppercase'
const OPEN_PAGE = 'Voir la release sur GitHub'

export function ReleaseHistoryItem({ entry, installed, expanded, onToggle }: ReleaseHistoryItemProps) {
  const { version, prerelease, publishedAt, pageUrl, sections } = entry
  const handleToggle = () => onToggle(version)
  const handleOpenPage = () => openReleaseHistoryPage(pageUrl)

  return (
    <li className="flex flex-col gap-3 border-b border-tily-line pb-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <button type="button" aria-expanded={expanded} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left" onClick={handleToggle}>
          <Icon name={IconName.Chevron} size={10} className={`shrink-0 text-tily-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
          <span className="text-[13px] font-semibold text-tily-ink">{version}</span>
          {prerelease && <span className={`${BADGE} border-tily-line text-tily-muted`}>Bêta</span>}
          {installed && <span className={`${BADGE} border-tily-green text-tily-green-deep`}>Installée</span>}
          {publishedAt && <span className={`ml-auto shrink-0 ${SETTINGS_HINT}`}>{formatDate(publishedAt)}</span>}
        </button>
        {pageUrl && (
          <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={OPEN_PAGE} data-tip={OPEN_PAGE} onClick={handleOpenPage}>
            <Icon name={IconName.GitHub} />
          </button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-col gap-4 pl-[18px]">
          {sections.length === 0 && <p className={SETTINGS_HINT}>Aucune note pour cette version.</p>}
          {sections.map(({ title, notes }, index) =>
            title ? (
              <section key={index} className="flex flex-col gap-2">
                <h4 className={SECTION_TITLE}>{title}</h4>
                <ReleaseNoteList notes={notes} />
              </section>
            ) : (
              <p key={index} className="text-[13px] text-tily-ink-soft">
                {notes.map((note, line) => (
                  <ReleaseNote key={line} text={note.title ? `${note.title} — ${note.text}` : note.text} />
                ))}
              </p>
            ),
          )}
        </div>
      )}
    </li>
  )
}
