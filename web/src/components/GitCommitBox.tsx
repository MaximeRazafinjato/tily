import type { ChangeEvent, KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { GitState } from '../bridge/gitMessages'
import { plural } from '../git/gitLabels'
import { commitChanges } from '../git/gitRequests'
import { useGitStore } from '../store/gitStore'
import { GIT_INPUT, GIT_PRIMARY, GIT_SECONDARY } from './rightPanelStyles'

interface GitCommitBoxProps {
  state: GitState
  busy: string | null
}

const commitBlocker = (state: GitState, busy: string | null, message: string, amend: boolean): string | null => {
  if (busy) {
    return 'Une opération Git est en cours'
  }
  if (state.operation) {
    return 'Terminez ou abandonnez d’abord l’opération en cours'
  }
  if (amend) {
    return state.head.unborn ? 'Aucun commit : amend impossible' : null
  }
  if (state.stagedTotal === 0) {
    return 'Aucune modification staged'
  }
  return message.trim().length === 0 ? 'Saisissez un message de commit' : null
}

const SUBJECT_MAX = 72
const GRAPHEMES = new Intl.Segmenter('fr', { granularity: 'grapheme' })
const LINE_BREAK = '\n'

const subjectTip = (length: number): string =>
  length > SUBJECT_MAX ? `Première ligne trop longue : ${length} caractères sur ${SUBJECT_MAX} conseillés` : `Première ligne : ${length} caractères sur ${SUBJECT_MAX} conseillés`

const pushBlocker = (state: GitState): string | null => {
  if (state.head.detached) {
    return 'HEAD détachée : push impossible'
  }
  return state.remotes.length === 0 ? 'Aucun dépôt distant configuré' : null
}

export function GitCommitBox({ state, busy }: GitCommitBoxProps) {
  const { message, amend } = useGitStore(useShallow((store) => ({ message: store.message, amend: store.amend })))
  const blocker = commitBlocker(state, busy, message, amend)
  const pushBlocked = blocker ?? pushBlocker(state)
  const commitLabel = amend ? 'Amend' : 'Commit'
  const subjectLength = [...GRAPHEMES.segment(message.split(LINE_BREAK)[0].trim())].length

  const handleMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => useGitStore.getState().setMessage(event.target.value)
  const handleAmendChange = (event: ChangeEvent<HTMLInputElement>) => {
    const last = state.lastMessage ?? ''
    const current = useGitStore.getState().message
    const next = event.target.checked ? (current.trim().length > 0 ? current : last) : current === last ? '' : current
    useGitStore.getState().setAmend(event.target.checked, next)
  }
  const handleCommit = () => {
    if (!blocker) {
      commitChanges(false)
    }
  }
  const handleCommitAndPush = () => {
    if (!pushBlocked) {
      commitChanges(true)
    }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.ctrlKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) {
        handleCommitAndPush()
      } else {
        handleCommit()
      }
    }
  }

  return (
    <div className="flex shrink-0 flex-col gap-[6px] border-t border-tily-line px-[10px] py-[8px]">
      <textarea
        value={message}
        rows={3}
        spellCheck={false}
        aria-label="Message du commit"
        placeholder={amend ? 'Message du commit (amend)' : 'Message du commit'}
        className={`${GIT_INPUT} resize-none leading-[17px]`}
        onChange={handleMessageChange}
        onKeyDown={handleKeyDown}
      />
      <div className="flex items-center gap-[6px]">
        <label className="flex min-w-0 flex-1 items-center gap-[6px] text-[12px] text-tily-ink-soft">
          <input type="checkbox" checked={amend} disabled={state.head.unborn} onChange={handleAmendChange} />
          <span className="truncate" data-tip="Amend du dernier commit">Amend</span>
        </label>
        {subjectLength > 0 && (
          <span className={`shrink-0 text-[11px] tabular-nums ${subjectLength > SUBJECT_MAX ? 'text-tily-warning' : 'text-tily-muted'}`} data-tip={subjectTip(subjectLength)}>
            {subjectLength}
          </span>
        )}
      </div>
      <div className="flex gap-[6px]">
        <button type="button" className={`${GIT_PRIMARY} min-w-0 flex-1 truncate`} aria-disabled={blocker !== null} data-tip={blocker ?? `${commitLabel} ${amend ? 'du dernier commit' : `de ${plural(state.stagedTotal, 'fichier staged', 'fichiers staged')}`} (Ctrl+Entrée)`} onClick={handleCommit}>
          {commitLabel}
        </button>
        <button type="button" className={`${GIT_SECONDARY} min-w-0 flex-1 truncate`} aria-disabled={pushBlocked !== null} data-tip={pushBlocked ?? `${commitLabel} puis push (Ctrl+Maj+Entrée)`} onClick={handleCommitAndPush}>
          {`${commitLabel} et push`}
        </button>
      </div>
    </div>
  )
}
