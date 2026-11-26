import { useSyncExternalStore } from 'react'

const subscribeVisibility = (onChange: () => void): (() => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

const pageVisible = (): boolean => document.visibilityState === 'visible'

export const usePageVisible = (): boolean => useSyncExternalStore(subscribeVisibility, pageVisible)
