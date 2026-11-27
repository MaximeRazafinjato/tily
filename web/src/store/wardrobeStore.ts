import { create } from 'zustand'
import { CosmeticSlot } from '../companions/cosmetics/cosmeticCatalog'

export interface WardrobeAnchor {
  x: number
  y: number
  radius: number
}

export interface WardrobeTarget {
  paneId: string
  project: string
  name: string
  hue: number
  anchor: WardrobeAnchor
}

interface WardrobeState {
  target: WardrobeTarget | null
  slot: CosmeticSlot
  trying: string | null
  bumps: number
  open: (target: WardrobeTarget) => void
  close: () => void
  selectSlot: (slot: CosmeticSlot) => void
  tryOn: (id: string | null) => void
  bump: () => void
}

export const useWardrobeStore = create<WardrobeState>((set) => ({
  target: null,
  slot: CosmeticSlot.Hat,
  trying: null,
  bumps: 0,
  open: (target) => set({ target, trying: null }),
  close: () => set({ target: null, trying: null }),
  selectSlot: (slot) => set({ slot, trying: null }),
  tryOn: (trying) => set({ trying }),
  bump: () => set((state) => ({ bumps: state.bumps + 1 })),
}))
