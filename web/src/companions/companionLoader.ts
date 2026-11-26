import { useAppearanceStore } from '../store/appearanceStore'

const companionsEnabled = (ambiance: ReturnType<typeof useAppearanceStore.getState>['ambiance']): boolean => Boolean(ambiance?.enabled && ambiance.companions.enabled)

export const startCompanions = (): (() => void) => {
  let stopLayer: (() => void) | undefined
  let loading = false
  let disposed = false
  const loadWhenEnabled = (): void => {
    if (stopLayer || loading || !companionsEnabled(useAppearanceStore.getState().ambiance)) {
      return
    }
    loading = true
    void import('./companionLayer').then(({ startCompanions: startLayer }) => {
      loading = false
      if (!disposed) {
        stopLayer = startLayer()
      }
    })
  }
  loadWhenEnabled()
  const unsubscribe = useAppearanceStore.subscribe(loadWhenEnabled)
  return () => {
    disposed = true
    unsubscribe()
    stopLayer?.()
    stopLayer = undefined
  }
}
