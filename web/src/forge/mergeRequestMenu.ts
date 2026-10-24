import type { MouseEvent } from 'react'
import type { ForgeKind, MergeRequest } from '../bridge/forgeMessages'
import type { ActionMenuItem } from '../components/ActionMenu'
import { useForgeStore, type MergeRequestMenuRequest } from '../store/forgeStore'
import { openMergeRequest } from './mergeRequestActions'
import { canEditMergeRequest, editMergeRequestLabel, openMergeRequestEditForm } from './mergeRequestFormActions'

let returnFocus: HTMLElement | null = null

export const openMergeRequestMenu = (event: MouseEvent<HTMLElement>, path: string, kind: ForgeKind | undefined, items: MergeRequest[]): void => {
  event.preventDefault()
  event.stopPropagation()
  if (items.length === 0) {
    return
  }
  const fromKeyboard = event.clientX === 0 && event.clientY === 0
  const box = event.currentTarget.getBoundingClientRect()
  returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
  useForgeStore.getState().setMenu({ x: fromKeyboard ? box.left : event.clientX, y: fromKeyboard ? box.bottom : event.clientY, path, kind, items })
}

export const closeMergeRequestMenu = (): void => {
  useForgeStore.getState().setMenu(null)
  if (returnFocus?.isConnected) {
    returnFocus.focus()
  }
  returnFocus = null
}

const itemsOf = (request: MergeRequestMenuRequest, item: MergeRequest): ActionMenuItem[] => {
  const suffix = request.items.length > 1 ? ` ${item.reference}` : ''
  return [
    ...(canEditMergeRequest(item) ? [{ id: `edit-${item.number}`, label: editMergeRequestLabel(item, request.kind), run: () => openMergeRequestEditForm(request.path, item) }] : []),
    { id: `open-${item.number}`, label: `Ouvrir${suffix} dans le navigateur`, run: () => openMergeRequest(item.url, false) },
    { id: `pane-${item.number}`, label: `Ouvrir${suffix} dans un pane navigateur`, run: () => openMergeRequest(item.url, true) },
  ]
}

const closingFirst = (entry: ActionMenuItem): ActionMenuItem => ({
  ...entry,
  run: () => {
    closeMergeRequestMenu()
    entry.run()
  },
})

export const mergeRequestMenuItems = (request: MergeRequestMenuRequest): ActionMenuItem[] => request.items.flatMap((item) => itemsOf(request, item)).map(closingFirst)
