import { GitConflictResolution, GitConflictView, type GitConflictFile } from '../bridge/gitMessages'
import { ConflictSide, keepLabel } from '../git/conflictLayout'
import { takeConflictSide } from '../git/gitConflictActions'
import { CONFLICT_LABELS } from '../git/gitLabels'
import { GIT_DANGER, GIT_SECONDARY } from './rightPanelStyles'

interface GitConflictChoiceProps {
  file: GitConflictFile
}

const EXPLANATIONS: Record<GitConflictView, string> = {
  [GitConflictView.Presence]: 'Le fichier n’existe que d’un côté : gardez la version restante ou supprimez le fichier.',
  [GitConflictView.Binary]: 'Fichier binaire : choisissez la version à garder.',
  [GitConflictView.TooLarge]: 'Fichier trop volumineux pour le résolveur (plus de 2 Mo) : choisissez la version à garder ou ouvrez-le dans l’éditeur.',
  [GitConflictView.Text]: '',
}

const handleKeepOurs = () => takeConflictSide(GitConflictResolution.Ours)
const handleKeepTheirs = () => takeConflictSide(GitConflictResolution.Theirs)
const handleDelete = () => takeConflictSide(GitConflictResolution.Delete)

export function GitConflictChoice({ file }: GitConflictChoiceProps) {
  const { view, kind, sides, oursExists, theirsExists } = file
  return (
    <div className="flex min-h-0 flex-1 flex-col items-start gap-[12px] overflow-auto p-[16px] text-[13px] text-tily-ink">
      <p className="font-semibold text-tily-warning">{CONFLICT_LABELS[kind]}</p>
      <p className="text-tily-ink-soft">{EXPLANATIONS[view]}</p>
      <div className="flex flex-wrap gap-[8px]">
        {oursExists && (
          <button type="button" className={GIT_SECONDARY} onClick={handleKeepOurs}>
            {keepLabel(ConflictSide.Ours, sides)}
          </button>
        )}
        {theirsExists && (
          <button type="button" className={GIT_SECONDARY} onClick={handleKeepTheirs}>
            {keepLabel(ConflictSide.Theirs, sides)}
          </button>
        )}
        {view === GitConflictView.Presence && (
          <button type="button" className={GIT_DANGER} onClick={handleDelete}>
            Supprimer le fichier
          </button>
        )}
      </div>
    </div>
  )
}
