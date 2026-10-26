import { useEffect, useRef } from 'react'
import { Command } from '../keyboard/commands'
import { useLeaderText, useShortcutText, useShortcutTip } from '../keyboard/shortcutLabels'

interface EmptyStateProps {
  canRestore: boolean
  onNewWorkspace: () => void
  onOpenProject: () => void
  onRestoreTab: () => void
}

const SECONDARY_BUTTON = 'cursor-pointer rounded border border-tily-line px-3 py-1.5 text-[13px] text-tily-ink hover:bg-tily-green-hover'

export function EmptyState({ canRestore, onNewWorkspace, onOpenProject, onRestoreTab }: EmptyStateProps) {
  const newWorkspaceRef = useRef<HTMLButtonElement>(null)
  const newWorkspaceTip = useShortcutTip('Nouveau workspace', Command.NewWorkspace)
  const openProjectTip = useShortcutTip('Ouvrir un projet', Command.Projects)
  const restoreTip = useShortcutTip('Rouvrir le dernier onglet fermé', Command.RestoreTab)
  const paletteShortcut = useShortcutText(Command.Palette)
  const leaderText = useLeaderText()

  useEffect(() => {
    if (document.activeElement === document.body) {
      newWorkspaceRef.current?.focus()
    }
  }, [])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-tily-muted">
      <div className="flex flex-col items-center gap-1">
        <p className="text-[15px]">Aucun workspace ouvert.</p>
        <p className="text-[12px]">Créez-en un pour lancer un terminal, ou ouvrez un dossier de projet.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button ref={newWorkspaceRef} type="button" className="cursor-pointer rounded border border-tily-green px-3 py-1.5 text-[13px] text-tily-green-deep hover:bg-tily-green-soft" data-tip={newWorkspaceTip} onClick={onNewWorkspace}>
          Nouveau workspace
        </button>
        <button type="button" className={SECONDARY_BUTTON} data-tip={openProjectTip} onClick={onOpenProject}>
          Ouvrir un projet…
        </button>
        {canRestore && (
          <button type="button" className={SECONDARY_BUTTON} data-tip={restoreTip} onClick={onRestoreTab}>
            Rouvrir le dernier onglet fermé
          </button>
        )}
      </div>
      <p className="text-[11px]">{`${paletteShortcut ? `${paletteShortcut} ouvre la palette · ` : ''}${leaderText} puis une lettre lance une commande au clavier`}</p>
    </div>
  )
}
