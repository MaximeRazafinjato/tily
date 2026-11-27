import { create } from 'zustand'
import type { FeatureFlags } from '../bridge/messages'

interface FeatureFlagState {
  flags: FeatureFlags
  setFlags: (flags: FeatureFlags) => void
}

export const useFeatureFlagStore = create<FeatureFlagState>((set) => ({
  flags: { companionCosmetics: false },
  setFlags: (flags) => set({ flags }),
}))
