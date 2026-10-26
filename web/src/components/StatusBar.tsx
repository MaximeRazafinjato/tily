import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { busyLabel } from '../git/gitBusy'
import { useGitStore } from '../store/gitStore'
import { StatusLevel, useHostStore } from '../store/hostStore'
import { useStatusLogStore } from '../store/statusLogStore'
import { useWorktreeStore } from '../store/worktreeStore'
import { toggleStatusLog } from '../statusLog/statusLogActions'
import { formatCommandDuration } from '../terminal/commandNotices'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { Spinner } from './Spinner'
import { STATUS_LOG_ID, StatusLogDrawer } from './StatusLogDrawer'
import { Command } from '../keyboard/commands'
import { useShortcutText, withShortcut } from '../keyboard/shortcutLabels'

const STATUS_CLASSES: Record<StatusLevel, string> = {
  [StatusLevel.Info]: 'text-tily-muted',
  [StatusLevel.Warning]: 'text-tily-warning',
  [StatusLevel.Error]: 'text-tily-error',
}

const INFO_FADE_MS = 8000

const untilTomorrow = (): number => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
}

export function StatusBar() {
  const [today, setToday] = useState(() => new Date())
  const [fadedAt, setFadedAt] = useState('')
  const status = useHostStore((state) => state.status)
  const unsaved = useHostStore((state) => state.unsaved)
  const logShortcut = useShortcutText(Command.ToggleStatusLog)
  const { busy, busyRefs } = useGitStore(useShallow((state) => ({ busy: state.busy, busyRefs: state.busyRefs })))
  const { worktreeTasks, purge } = useWorktreeStore(useShallow((state) => ({ worktreeTasks: state.tasks.length, purge: state.purge })))
  const worktreeBusy = worktreeTasks > 0
  const waiting = worktreeTasks - 1
  const logOpen = useStatusLogStore((state) => state.open)
  const spinning = Boolean(busy) || worktreeBusy

  useEffect(() => {
    const timer = setTimeout(() => setToday(new Date()), untilTomorrow())
    return () => clearTimeout(timer)
  }, [today])

  useEffect(() => {
    if (status.level !== StatusLevel.Info || !status.at) {
      return
    }
    const timer = setTimeout(() => setFadedAt(status.at), INFO_FADE_MS)
    return () => clearTimeout(timer)
  }, [status.at, status.level])

  const statusText = status.level === StatusLevel.Info && status.at !== '' && fadedAt === status.at ? '' : status.text

  return (
    <>
      {logOpen && <StatusLogDrawer today={today} />}
      <footer className={`flex h-[24px] shrink-0 items-center border-t border-tily-line bg-tily-paper text-[11px] ${spinning ? 'text-tily-ink-soft' : STATUS_CLASSES[status.level]}`}>
        <button
          type="button"
          data-status-log-toggle=""
          aria-expanded={logOpen}
          aria-controls={logOpen ? STATUS_LOG_ID : undefined}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-[6px] px-3 text-left hover:bg-tily-green-hover"
          onClick={toggleStatusLog}
        >
          <span className="flex shrink-0" data-tip={withShortcut(logOpen ? 'Masquer le journal' : 'Afficher le journal', logShortcut)}>
            <Icon name={IconName.Chevron} size={10} className={`text-tily-muted transition-transform ${logOpen ? 'rotate-90' : '-rotate-90'}`} />
          </span>
          {spinning && <Spinner size={10} className="shrink-0 text-tily-green" />}
          <span className="truncate py-1 [text-box:trim-both_cap_alphabetic]">{busy ? busyLabel(busy, busyRefs) : statusText}</span>
        </button>
        <span role="status" className="sr-only">
          {status.text}
        </span>
        {waiting > 0 && (
          <span className="shrink-0 px-3 text-tily-muted" data-tip={`${waiting} opération${waiting > 1 ? 's' : ''} de worktree en attente`}>
            {`+${waiting} en attente`}
          </span>
        )}
        {purge && (
          <span className="flex shrink-0 items-center gap-[6px] px-3 text-tily-muted tabular-nums" data-tip="Fichiers d’un worktree supprimé, effacés en arrière-plan">
            <Spinner size={10} className="shrink-0 text-tily-green" />
            {`Effacement de « ${purge.name} » : ${purge.files.toLocaleString('fr-FR')} fichiers (${formatCommandDuration(purge.elapsedMs)})`}
          </span>
        )}
        {unsaved && (
          <span className="shrink-0 px-3 text-tily-error" data-tip="La dernière sauvegarde a échoué : la session restera en l’état d’avant tant qu’une écriture ne réussit pas.">
            Non enregistré
          </span>
        )}
      </footer>
    </>
  )
}
