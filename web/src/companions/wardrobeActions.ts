import type { CompanionOutfit } from '../bridge/appearanceMessages'
import { projectOutfit, setProjectOutfit } from '../appearance/appearanceActions'
import { focusActivePane } from '../explorer/fileExplorerActions'
import { useWardrobeStore } from '../store/wardrobeStore'
import type { CosmeticSlot } from './cosmetics/cosmeticCatalog'

const dressTarget = (dress: (outfit: CompanionOutfit) => CompanionOutfit): void => {
  const { target, tryOn, bump } = useWardrobeStore.getState()
  if (!target) {
    return
  }
  setProjectOutfit(target.project, dress(projectOutfit(target.project)))
  tryOn(null)
  bump()
}

export const wearCosmetic = (slot: CosmeticSlot, id: string): void =>
  dressTarget((outfit) => {
    const next = { ...outfit }
    if (next[slot] === id) {
      delete next[slot]
    } else {
      next[slot] = id
    }
    return next
  })

export const removeCosmetic = (slot: CosmeticSlot): void =>
  dressTarget((outfit) => {
    const next = { ...outfit }
    delete next[slot]
    return next
  })

export const undress = (): void => dressTarget(() => ({}))

export const closeWardrobe = (): void => {
  useWardrobeStore.getState().close()
  focusActivePane()
}
