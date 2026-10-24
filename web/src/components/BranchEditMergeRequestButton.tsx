import { branchKey, useForgeStore } from '../store/forgeStore'
import { EditMergeRequestButton } from './EditMergeRequestButton'

interface BranchEditMergeRequestButtonProps {
  path: string
  branch: string
  className?: string
}

export function BranchEditMergeRequestButton({ path, branch, className }: BranchEditMergeRequestButtonProps) {
  const result = useForgeStore((store) => store.branches[branchKey(path, branch)])
  const first = result?.items[0]
  return first ? <EditMergeRequestButton path={path} item={first} kind={result.forge?.kind} className={className} /> : null
}
