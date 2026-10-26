import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { GitCommitDetails, GitFileChange } from '../bridge/gitMessages'
import { CHANGE_CLASSES, CHANGE_LABELS, CHANGE_LETTERS, fileFolder, fileName, fullDate, plural, shortSha } from '../git/gitLabels'
import { copyToClipboard, showCommitFile } from '../git/gitRequests'
import type { GitFileTarget } from '../store/gitStore'
import { SECTION_TITLE } from './rightPanelStyles'

interface GitCommitSummaryProps {
  details: GitCommitDetails | null
  error: string | null
  selected: GitFileTarget | null
  stash: boolean
  heading: ReactNode
  actions: ReactNode
}

const CARD = 'mx-[8px] flex shrink-0 flex-col gap-[6px] rounded-md border border-tily-line bg-tily-panel px-[12px] py-[10px]'

const subjectOf = (message: string): string => message.split('\n')[0]

const bodyOf = (message: string): string => message.split('\n').slice(1).join('\n').trim()

export function GitCommitSummary({ details, error, selected, stash, heading, actions }: GitCommitSummaryProps) {
  const [focusPath, setFocusPath] = useState<string | null>(null)
  if (!details) {
    return (
      <div className={CARD}>
        {heading}
        <p className={`text-[12px] ${error ? 'text-tily-error' : 'text-tily-muted italic'}`}>{error ?? 'Lecture du commit…'}</p>
      </div>
    )
  }
  const body = bodyOf(details.message)
  const focusable = details.files.find((change) => change.path === focusPath)?.path ?? details.files.find((change) => change.path === selected?.path)?.path ?? details.files[0]?.path
  const handleCopySha = () => copyToClipboard(details.sha, `SHA copié : ${shortSha(details.sha)}`)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-git-row]'))
    const index = buttons.indexOf(event.target as HTMLElement)
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: buttons.length - 1 }
    if (!(event.key in moves) || index < 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const target = buttons[Math.min(Math.max(moves[event.key], 0), buttons.length - 1)]
    setFocusPath(target?.dataset.gitRow ?? null)
    target?.focus()
  }
  const renderFile = (change: GitFileChange) => {
    const isSelected = selected?.path === change.path
    const handleSelect = () => {
      setFocusPath(change.path)
      showCommitFile(details.sha, change)
    }
    return (
      <button
        key={change.path}
        type="button"
        role="option"
        aria-selected={isSelected}
        data-git-row={change.path}
        tabIndex={change.path === focusable ? 0 : -1}
        className={`flex h-[22px] w-full shrink-0 cursor-pointer items-center gap-[6px] px-[12px] text-left text-[12px] ${isSelected ? 'bg-tily-green-soft text-tily-green-deep' : 'text-tily-ink-soft hover:bg-tily-green-hover hover:text-tily-ink'}`}
        onClick={handleSelect}
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-[6px]">
          <span className={`w-[12px] shrink-0 text-center font-mono text-[11px] font-semibold ${CHANGE_CLASSES[change.kind]}`} data-tip={change.oldPath ? `${CHANGE_LABELS[change.kind]} depuis ${change.oldPath}` : CHANGE_LABELS[change.kind]}>
            {CHANGE_LETTERS[change.kind]}
          </span>
          <span className="min-w-0 shrink truncate">{fileName(change.path)}</span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-tily-muted">{fileFolder(change.path)}</span>
        </span>
      </button>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={CARD}>
        {heading}
        <p className="text-[13.5px] font-semibold break-words text-tily-ink">{subjectOf(details.message)}</p>
        {body && <pre className="max-h-[160px] overflow-auto font-sans text-[12px] whitespace-pre-wrap text-tily-ink-soft">{body}</pre>}
        <div className="flex flex-wrap items-baseline gap-x-[12px] gap-y-[2px] text-[11px] text-tily-muted">
          <button type="button" className="cursor-pointer font-mono text-tily-green-deep hover:underline" data-tip="Copier le SHA" onClick={handleCopySha}>
            {details.sha.slice(0, 12)}
          </button>
          <span data-tip={details.email}>{details.author}</span>
          <span>{fullDate(details.date)}</span>
          {stash && <span>{`Stash sur ${shortSha(details.parents[0])}`}</span>}
          {!stash && details.parents.length > 1 && <span>{`Merge de ${details.parents.map(shortSha).join(' et ')}`}</span>}
        </div>
        {actions}
      </div>
      <p className={`shrink-0 px-[12px] pt-[12px] pb-[4px] ${SECTION_TITLE}`}>{plural(details.files.length, 'fichier modifié', 'fichiers modifiés')}</p>
      <div role="listbox" aria-label="Fichiers du commit : Entrée ou clic pour voir le diff" className="min-h-0 flex-1 overflow-auto pb-[4px]" onKeyDown={handleKeyDown}>
        {details.files.map(renderFile)}
      </div>
    </div>
  )
}
