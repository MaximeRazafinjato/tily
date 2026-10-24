import type { ForgeUser, MergeRequest } from '../bridge/forgeMessages'
import { normalize } from '../palette/searchFilter'
import type { MergeRequestFilter } from '../store/forgeStore'

const searchableText = (item: MergeRequest): string =>
  normalize([item.reference, item.title, item.author.login, item.author.name, item.sourceBranch, item.targetBranch].join(' '))

const matchesText = (item: MergeRequest, words: string[]): boolean => {
  const text = searchableText(item)
  return words.every((word) => text.includes(word))
}

export const filterMergeRequests = (items: MergeRequest[], filter: MergeRequestFilter): MergeRequest[] => {
  const words = normalize(filter.text).split(/\s+/).filter(Boolean)
  return items.filter(
    (item) =>
      (filter.labels.length === 0 || item.labels.some((label) => filter.labels.includes(label))) &&
      (filter.assignees.length === 0 || item.assignees.some((assignee) => filter.assignees.includes(assignee.login))) &&
      matchesText(item, words),
  )
}

export const filterActive = (filter: MergeRequestFilter): boolean => filter.labels.length > 0 || filter.assignees.length > 0 || filter.text.trim().length > 0

export const labelFacets = (items: MergeRequest[], selected: string[]): string[] =>
  [...new Set([...items.flatMap((item) => item.labels), ...selected])].sort((first, second) => first.localeCompare(second, 'fr', { sensitivity: 'base' }))

export const assigneeFacets = (items: MergeRequest[], selected: string[], currentUser: string | undefined): ForgeUser[] => {
  const users = new Map<string, ForgeUser>()
  for (const assignee of items.flatMap((item) => item.assignees)) {
    users.set(assignee.login, assignee)
  }
  for (const login of [...selected, currentUser].filter((login): login is string => Boolean(login))) {
    if (!users.has(login)) {
      users.set(login, { login, name: login })
    }
  }
  return [...users.values()].sort((first, second) => {
    if (first.login === currentUser || second.login === currentUser) {
      return first.login === currentUser ? -1 : 1
    }
    return first.name.localeCompare(second.name, 'fr', { sensitivity: 'base' })
  })
}
