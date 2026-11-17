import { ambianceBackgroundShown } from '../ambiance/ambianceActions'
import { useAppearanceStore } from '../store/appearanceStore'
import { AmbianceLayer } from './AmbianceLayer'

export function AmbientBackground() {
  const ambiance = useAppearanceStore((store) => store.ambiance)
  if (!ambiance || !ambianceBackgroundShown(ambiance)) {
    return null
  }

  return <AmbianceLayer ambiance={ambiance} scope="tily-ambient-app" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" />
}
