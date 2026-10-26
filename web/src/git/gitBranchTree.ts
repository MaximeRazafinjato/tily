import type { GitBranch } from '../bridge/gitMessages'

interface GitBranchLeaf<T> {
  item: T
  label: string
}

interface PinnedBranches {
  pinned: GitBranch[]
  others: GitBranch[]
}

export interface GitBranchFolder<T> {
  path: string
  name: string
  count: number
  folders: GitBranchFolder<T>[]
  leaves: GitBranchLeaf<T>[]
}

const REF_INDENT_PX = 14
const REF_BASE_PADDING_PX = 12
const PINNED_NAMES = ['main', 'master', 'preprod', 'develop', 'evolutions']
const CURRENT_RANK = -1

export const refIndent = (depth: number): number => REF_BASE_PADDING_PX + depth * REF_INDENT_PX

const emptyFolder = <T>(path: string, name: string): GitBranchFolder<T> => ({ path, name, count: 0, folders: [], leaves: [] })

const childFolder = <T>(parent: GitBranchFolder<T>, name: string): GitBranchFolder<T> => {
  const existing = parent.folders.find((folder) => folder.name === name)
  if (existing) {
    return existing
  }
  const created = emptyFolder<T>(parent.path ? `${parent.path}/${name}` : name, name)
  parent.folders.push(created)
  return created
}

export const branchTree = <T>(items: T[], nameOf: (item: T) => string): GitBranchFolder<T> => {
  const root = emptyFolder<T>('', '')
  for (const item of items) {
    const segments = nameOf(item).split('/')
    const label = segments.pop() ?? ''
    let folder = root
    folder.count += 1
    for (const segment of segments) {
      folder = childFolder(folder, segment)
      folder.count += 1
    }
    folder.leaves.push({ item, label })
  }
  return root
}

const isPinned = (branch: GitBranch): boolean => branch.current || PINNED_NAMES.includes(branch.name)

const pinRank = (branch: GitBranch): number => (branch.current ? CURRENT_RANK : PINNED_NAMES.indexOf(branch.name))

export const splitPinnedBranches = (branches: GitBranch[]): PinnedBranches => ({
  pinned: branches.filter(isPinned).sort((first, second) => pinRank(first) - pinRank(second)),
  others: branches.filter((branch) => !isPinned(branch)),
})

export const visibleBranches =<T>(folder: GitBranchFolder<T>, isCollapsed: (path: string) => boolean): T[] => [
  ...folder.folders.flatMap((child) => (isCollapsed(child.path) ? [] : visibleBranches(child, isCollapsed))),
  ...folder.leaves.map((leaf) => leaf.item),
]
