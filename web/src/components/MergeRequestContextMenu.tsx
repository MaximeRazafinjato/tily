import { closeMergeRequestMenu, mergeRequestMenuItems } from '../forge/mergeRequestMenu'
import { kindNoun } from '../forge/mergeRequestLabels'
import { useForgeStore } from '../store/forgeStore'
import { FloatingMenu } from './FloatingMenu'

export function MergeRequestContextMenu() {
  const menu = useForgeStore((store) => store.menu)
  if (!menu) {
    return null
  }

  return <FloatingMenu x={menu.x} y={menu.y} label={`Actions de la ${kindNoun(menu.kind)}`} items={mergeRequestMenuItems(menu)} onClose={closeMergeRequestMenu} />
}
