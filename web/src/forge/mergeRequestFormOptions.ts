import type { ForgeLabel, ForgeUser, MergeRequestBranchInfo } from '../bridge/forgeMessages'
import { normalize } from '../palette/searchFilter'
import type { MergeRequestForm } from '../store/mergeRequestFormStore'

export interface ChoiceOption {
  id: string
  label: string
  hint?: string
  color?: string
}

const ME = 'moi'

export const memberOptions = (members: ForgeUser[], currentUser: string | undefined): ChoiceOption[] => {
  const options = members.map((member) => {
    const named = member.name.length > 0 && member.name !== member.login
    const hints = [named ? member.login : null, member.login === currentUser ? ME : null].filter((hint) => hint !== null)
    return { id: member.login, label: named ? member.name : member.login, hint: hints.length > 0 ? hints.join(' · ') : undefined }
  })
  return [...options.filter((option) => option.id === currentUser), ...options.filter((option) => option.id !== currentUser)]
}

export const labelOptions = (labels: ForgeLabel[]): ChoiceOption[] =>
  labels.map((label) => ({ id: label.name, label: label.name, hint: label.description || undefined, color: label.color || undefined }))

export const filterOptions = (options: ChoiceOption[], text: string): ChoiceOption[] => {
  const words = normalize(text).split(/\s+/).filter(Boolean)
  return words.length === 0 ? options : options.filter((option) => words.every((word) => normalize(`${option.label} ${option.id} ${option.hint ?? ''}`).includes(word)))
}

export const optionLabel = (options: ChoiceOption[], id: string): string => options.find((option) => option.id === id)?.label ?? id

const plural = (count: number, word: string): string => `${count} ${word}${count > 1 ? 's' : ''}`

export const publicationNotice = (branch: MergeRequestBranchInfo): string | null => {
  const { publication, source } = branch
  if (!publication.local || !publication.needsPush) {
    return null
  }
  return publication.published ? `${plural(publication.ahead, 'commit')} de « ${source} » pas encore poussé${publication.ahead > 1 ? 's' : ''} sur origin.` : `La branche « ${source} » n’est pas publiée sur origin.`
}

export const commitsNotice = (branch: MergeRequestBranchInfo): string =>
  branch.commits === 0 ? `Aucun commit d’avance sur « ${branch.target} ».` : `${plural(branch.commits, 'commit')} d’avance sur « ${branch.target} ».`

export const otherAssigneesNotice = (form: MergeRequestForm): string | null => {
  const edit = form.data?.edit
  const others = edit?.assignees.filter((user) => user.login !== edit.input.assignee) ?? []
  if (!edit || others.length === 0) {
    return null
  }
  const names = others.map((user) => user.name || user.login).join(', ')
  return form.fields.assignee === edit.input.assignee ? `Aussi assignée à ${names}, gardé${others.length > 1 ? 's' : ''} tant que l’assigné ne change pas.` : `${names} ne ser${others.length > 1 ? 'ont' : 'a'} plus assigné${others.length > 1 ? 's' : ''}.`
}
