import { useEffect, useRef, useState } from 'react'
import type { GitConflictFile } from '../bridge/gitMessages'
import { resultContent, ConflictSide, sideTitle } from '../git/conflictLayout'
import { createConflictMerge, type ConflictMergeController, type SideChecks } from '../git/conflictMerge'
import { PickCheck } from '../git/conflictPicks'
import { markConflictDirty, saveConflictResult } from '../git/gitConflictActions'
import { plural } from '../git/gitLabels'
import { GitConflictSideTitle } from './GitConflictSideTitle'
import { GitToolButton } from './GitToolButton'
import { IconName } from './iconName'
import { GIT_PRIMARY } from './rightPanelStyles'

interface GitConflictMergeProps {
  file: GitConflictFile
}

const PANE = 'flex min-h-0 min-w-0 flex-1 flex-col border-tily-line'
const EDITOR = 'min-h-0 flex-1 overflow-hidden'
const NO_CHECKS: SideChecks = { [ConflictSide.Ours]: PickCheck.Unchecked, [ConflictSide.Theirs]: PickCheck.Unchecked }

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
  const [checks, setChecks] = useState<SideChecks>(NO_CHECKS)

  useEffect(() => {
    const [ours, result, theirs] = [oursRef.current, resultRef.current, theirsRef.current]
    if (!ours || !result || !theirs) {
      return
    }
    const save = () => saveFrom(controllerRef.current, file.finalNewline)
    const controller = createConflictMerge({ ours, result, theirs }, file, { onStatus: setUnresolved, onSides: setChecks, onChange: markConflictDirty, onSave: save })
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
  const handleToggleSide = (side: ConflictSide) => controllerRef.current?.toggleSide(side)
  const status = unresolved > 0 ? `${plural(unresolved, 'conflit', 'conflits')} sur ${total} à résoudre` : total > 0 ? 'Tous les conflits sont résolus' : 'Aucun bloc en conflit'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <section className={PANE}>
          <GitConflictSideTitle side={ConflictSide.Ours} title={sideTitle(ConflictSide.Ours, file.sides)} check={checks[ConflictSide.Ours]} disabled={total === 0} onToggle={handleToggleSide} />
          <div ref={oursRef} className={EDITOR} />
        </section>
        <section className={`${PANE} border-l`}>
          <GitConflictSideTitle side={ConflictSide.Theirs} title={sideTitle(ConflictSide.Theirs, file.sides)} check={checks[ConflictSide.Theirs]} disabled={total === 0} onToggle={handleToggleSide} />
          <div ref={theirsRef} className={EDITOR} />
        </section>
      </div>
      <section className={`${PANE} border-t`}>
        <div className="flex h-[36px] shrink-0 items-center gap-[4px] border-b border-tily-line bg-tily-paper px-[8px]">
          <span className="shrink-0 pl-[4px] text-[12px] font-semibold text-tily-ink">Résultat</span>
          <span className={`min-w-0 flex-1 truncate pl-[8px] text-[12px] ${unresolved > 0 ? 'text-tily-warning' : 'text-tily-green-deep'}`}>{status}</span>
          <GitToolButton icon={IconName.Chevron} iconClassName="-rotate-90" tip="Conflit précédent (Maj+F7)" disabled={total === 0} onClick={handlePrevious} />
          <GitToolButton icon={IconName.Chevron} iconClassName="rotate-90" tip="Conflit suivant (F7)" disabled={total === 0} onClick={handleNext} />
          <button type="button" className={`${GIT_PRIMARY} ml-[4px]`} aria-disabled={unresolved > 0} data-tip={unresolved > 0 ? 'Résolvez d’abord tous les conflits' : 'Enregistrer le résultat et marquer le fichier résolu (Ctrl+S)'} onClick={handleSave}>
            Enregistrer et marquer résolu
          </button>
        </div>
        <div ref={resultRef} className={EDITOR} />
      </section>
    </div>
  )
}
