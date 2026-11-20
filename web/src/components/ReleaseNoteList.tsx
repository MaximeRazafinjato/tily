import type { UpdateReleaseNote } from '../bridge/updateMessages'
import { ReleaseNote } from './ReleaseNote'

interface ReleaseNoteListProps {
  notes: UpdateReleaseNote[]
}

export function ReleaseNoteList({ notes }: ReleaseNoteListProps) {
  return (
    <ul className="flex flex-col gap-3 text-[13px]">
      {notes.map(({ title, text }, index) => (
        <li key={index} className="flex gap-2.5">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-tily-green" />
          <span className="flex min-w-0 flex-col gap-0.5">
            {title && (
              <strong className="font-semibold text-tily-ink">
                <ReleaseNote text={title} />
              </strong>
            )}
            <span className={title ? 'text-tily-ink-soft' : 'text-tily-ink'}>
              <ReleaseNote text={text} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
