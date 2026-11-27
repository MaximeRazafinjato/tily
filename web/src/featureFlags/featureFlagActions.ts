import { bridge } from '../bridge/bridge'
import type { FeatureFlags } from '../bridge/messages'
import { useFeatureFlagStore } from '../store/featureFlagStore'
import { useWardrobeStore } from '../store/wardrobeStore'

export const companionCosmeticsEnabled = (): boolean => useFeatureFlagStore.getState().flags.companionCosmetics

export const receiveFeatureFlags = (flags: FeatureFlags): void => {
  useFeatureFlagStore.getState().setFlags(flags)
  if (!flags.companionCosmetics) {
    useWardrobeStore.getState().close()
  }
}

export const saveFeatureFlags = (patch: Partial<FeatureFlags>): void => bridge.send({ type: 'featureFlags.save', flags: { ...useFeatureFlagStore.getState().flags, ...patch } })
