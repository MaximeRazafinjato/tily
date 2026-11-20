import { useShallow } from 'zustand/react/shallow'
import { cloneFromDialogPending, useCloneStore } from '../store/cloneStore'
import { CloneDialog } from './CloneDialog'

export function CloneDialogs() {
  const { draft, plan, roots, planPending, busy, failure } = useCloneStore(
    useShallow((state) => ({ draft: state.draft, plan: state.plan, roots: state.roots, planPending: state.planPending, busy: cloneFromDialogPending(state.tasks), failure: state.failure })),
  )

  return draft && <CloneDialog draft={draft} plan={plan} roots={roots} planPending={planPending} busy={busy} failure={failure} />
}
