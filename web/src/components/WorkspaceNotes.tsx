import type { ChangeEvent, KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { activeWorkspace, NOTE_MAX_CHARS } from '../model/session'
import { useSessionStore } from '../store/sessionStore'
import { sendTextToActivePane } from '../terminal/terminalActions'
import { InfoTip } from './InfoTip'

const NOTE_HINT_ID = 'workspace-note-hint'
const LINE_BREAK = '\n'
const TRAILING_LINE_BREAKS = /[\r\n]+$/
const NOTE_HELP = 'Enregistrées avec la session. Ctrl+Entrée colle la ligne ou la sélection dans le terminal actif, Ctrl+Maj+Entrée l’exécute.'

const noteTextToSend = (value: string, start: number, end: number): string => {
  if (start !== end) {
    return value.slice(start, end).replace(TRAILING_LINE_BREAKS, '')
  }
  const lineStart = value.lastIndexOf(LINE_BREAK, start - 1) + 1
  const lineEnd = value.indexOf(LINE_BREAK, start)
  return value.slice(lineStart, lineEnd < 0 ? value.length : lineEnd)
}

export function WorkspaceNotes() {
  const { id, note } = useSessionStore(
    useShallow((state) => {
      const workspace = state.session ? activeWorkspace(state.session) : undefined
      return { id: workspace?.id, note: workspace?.note ?? '' }
    }),
  )

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (id) {
      useSessionStore.getState().setWorkspaceNote(id, event.target.value)
    }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      focusActivePane()
    } else if (event.key === 'Enter' && event.ctrlKey && !event.altKey) {
      event.preventDefault()
      const { value, selectionStart, selectionEnd } = event.currentTarget
      sendTextToActivePane(noteTextToSend(value, selectionStart, selectionEnd), event.shiftKey)
    }
  }

  return (
    <section aria-label="Notes du workspace" className="relative flex min-h-0 flex-1 flex-col px-[12px] pt-[4px] pb-[12px]">
      <textarea
        data-workspace-note=""
        value={note}
        maxLength={NOTE_MAX_CHARS}
        spellCheck={false}
        placeholder="Notes du workspace…"
        aria-label="Notes du workspace"
        className="min-h-0 flex-1 resize-none rounded border border-tily-line bg-tily-panel py-[8px] pr-[28px] pl-[10px] text-[12px] leading-[1.5] text-tily-ink outline-none placeholder:text-tily-muted focus:border-tily-focus"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-describedby={NOTE_HINT_ID}
      />
      <span className="absolute top-[12px] right-[20px] flex">
        <InfoTip text={NOTE_HELP} />
      </span>
      <p id={NOTE_HINT_ID} className="sr-only">
        {NOTE_HELP}
      </p>
    </section>
  )
}
