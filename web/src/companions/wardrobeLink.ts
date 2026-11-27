import { useWardrobeStore } from '../store/wardrobeStore'
import type { Blob, World } from './blobModel'
import { bumpFocus, closeFocus, focusedBlob, focusHomeX, openFocus } from './wardrobeFocus'

const rootOf = (blob: Blob): Blob => blob.parent ?? blob

export const openWardrobeFor = (world: World, blob: Blob): void => {
  const owner = rootOf(blob)
  if (!owner.project) {
    return
  }
  useWardrobeStore.getState().open({
    paneId: owner.paneId,
    project: owner.project,
    name: owner.name,
    hue: owner.hue,
    anchor: { x: focusHomeX(world, owner), y: owner.y, radius: owner.radius },
  })
}

const previewOf = (world: World): void => {
  const blob = focusedBlob(world)
  const { slot, trying } = useWardrobeStore.getState()
  if (world.focus && blob) {
    world.focus.preview = trying ? { ...blob.outfit, [slot]: trying } : null
  }
}

export const linkWardrobe = (world: World): (() => void) => {
  const unsubscribe = useWardrobeStore.subscribe((state, previous) => {
    if (state.target !== previous.target) {
      const blob = state.target ? world.blobs.find((candidate) => !candidate.parent && candidate.paneId === state.target?.paneId) : undefined
      if (blob) {
        openFocus(world, blob)
      } else {
        closeFocus(world)
      }
    }
    if (state.trying !== previous.trying || state.slot !== previous.slot) {
      previewOf(world)
    }
    if (state.bumps !== previous.bumps) {
      bumpFocus(world)
    }
  })
  return () => {
    unsubscribe()
    useWardrobeStore.getState().close()
  }
}

export const keepWardrobeLinked = (world: World): void => {
  const { target, close } = useWardrobeStore.getState()
  if (target && !world.focus?.open) {
    close()
  }
}
