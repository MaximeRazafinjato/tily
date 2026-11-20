import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/sessionStore'
import type { GitConflictFile } from '../bridge/gitMessages'
import { resultContent, ConflictSide, sideTitle } from '../git/conflictLayout'
import { createConflictMerge, type ConflictMergeController } from '../git/conflictMerge'
import { markConflictDirty, saveConflictResult } from '../git/gitConflictActions'
import { plural } from '../git/gitLabels'
import { GitToolButton } from './GitToolButton'
import { IconName } from './iconName'
import { GIT_PRIMARY } from './rightPanelStyles'

interface GitConflictMergeProps {
  file: GitConflictFile
}

const PANE = 'flex min-h-0 min-w-0 flex-col border-tily-line'
const PANE_TITLE = 'shrink-0 truncate border-b border-tily-line bg-tily-paper px-[12px] py-[4px] text-[11px] font-semibold text-tily-muted'
const EDITOR = 'min-h-0 flex-1 overflow-hidden'

const handleToggleRows = () => {
  const { session, setGitGraphLayout } = useSessionStore.getState()
  setGitGraphLayout({ conflictRows: !session?.gitGraph.conflictRows })
}

const saveFrom = (controller: ConflictMergeController | null, finalNewline: boolean): void => {
  if (controller) {
    saveConflictResult(resultContent(controller.content(), finalNewline), controller.unresolved())
  }
}

export function GitConflictMerge({ file }: GitConflictMergeProps) {
  const oursRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const theirsRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<ConflictMergeController | null>(null)
  const [unresolved, setUnresolved] = useState(0)
  const [total, setTotal] = useState(0)
  const rows = useSessionStore((store) => store.session?.gitGraph.conflictRows ?? false)

  useEffect(() => {
    const [ours, result, theirs] = [oursRef.current, resultRef.current, theirsRef.current]
    if (!ours || !result || !theirs) {
      return
    }
    const save = () => saveFrom(controllerRef.current, file.finalNewline)
    const controller = createConflictMerge({ ours, result, theirs }, file, { onStatus: setUnresolved, onChange: markConflictDirty, onSave: save })
    controllerRef.current = controller
    setTotal(controller.total)
    return () => {
      controllerRef.current = null
      controller.destroy()
    }
  }, [file])

  const handlePrevious = () => controllerRef.current?.previous()
  const handleNext = () => controllerRef.current?.next()
  const handleSave = () => saveFrom(controllerRef.current, file.finalNewline)
  const separator = rows ? 'border-t' : 'border-l'
  const status = unresolved > 0 ? `${plural(unresolved, 'conflit', 'conflits')} sur ${total} à résoudre` : total > 0 ? 'Tous les conflits sont résolus' : 'Aucun bloc en conflit'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-[36px] shrink-0 items-center gap-[4px] border-b border-tily-line px-[8px]">
        <GitToolButton icon={IconName.Chevron} iconClassName="-rotate-90" tip="Conflit précédent (Maj+F7)" disabled={total === 0} onClick={handlePrevious} />
        <GitToolButton icon={IconName.Chevron} iconClassName="rotate-90" tip="Conflit suivant (F7)" disabled={total === 0} onClick={handleNext} />
        <span className={`min-w-0 flex-1 truncate pl-[4px] text-[12px] ${unresolved > 0 ? 'text-tily-warning' : 'text-tily-green-deep'}`}>{status}</span>
        <GitToolButton icon={IconName.Columns} iconClassName={rows ? 'rotate-90' : undefined} tip={rows ? 'Afficher en colonnes' : 'Afficher en lignes'} onClick={handleToggleRows} />
        <button type="button" className={GIT_PRIMARY} aria-disabled={unresolved > 0} data-tip={unresolved > 0 ? 'Résolvez d’abord tous les conflits' : 'Enregistrer le résultat et marquer le fichier résolu (Ctrl+S)'} onClick={handleSave}>
          Enregistrer et marquer résolu
        </button>
      </div>
      <div className={`grid min-h-0 flex-1 ${rows ? 'grid-rows-3' : 'grid-cols-3'}`}>
        <section className={PANE}>
          <span className={PANE_TITLE} data-tip={sideTitle(ConflictSide.Ours, file.sides)}>
            {sideTitle(ConflictSide.Ours, file.sides)}
          </span>
          <div ref={oursRef} className={EDITOR} />
        </section>
        <section className={`${PANE} ${separator}`}>
          <span className={`${PANE_TITLE} text-tily-ink`}>Résultat</span>
          <div ref={resultRef} className={EDITOR} />
        </section>
        <section className={`${PANE} ${separator}`}>
          <span className={PANE_TITLE} data-tip={sideTitle(ConflictSide.Theirs, file.sides)}>
            {sideTitle(ConflictSide.Theirs, file.sides)}
          </span>
          <div ref={theirsRef} className={EDITOR} />
        </section>
      </div>
    </div>
  )
}
