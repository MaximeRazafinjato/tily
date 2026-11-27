import { lazy, Suspense } from 'react'
import { useWardrobeStore } from '../store/wardrobeStore'

const CompanionWardrobe = lazy(() => import('./CompanionWardrobe').then((module) => ({ default: module.CompanionWardrobe })))

export function LazyCompanionWardrobe() {
  const target = useWardrobeStore((store) => store.target)
  return target ? (
    <Suspense fallback={null}>
      <CompanionWardrobe key={target.paneId} />
    </Suspense>
  ) : null
}
