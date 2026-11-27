import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { CosmeticSlot, WARDROBE } from '../companions/cosmetics/cosmeticCatalog'
import { closeWardrobe, removeCosmetic, undress, wearCosmetic } from '../companions/wardrobeActions'
import { useAppearanceStore } from '../store/appearanceStore'
import { useWardrobeStore, type WardrobeTarget } from '../store/wardrobeStore'
import { CompanionWardrobeTile } from './CompanionWardrobeTile'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { GIT_SECONDARY, PANEL_HEADER_BUTTON } from './rightPanelStyles'

const PANEL_WIDTH = 460
const PANEL_HEIGHT = 380
const EDGE_PX = 8
const GAP_PX = 18
const GROWN_RADIUS = 1.8
const LAYER_ABOVE_COMPANIONS = 26

const placementOf = ({ anchor }: WardrobeTarget): { left: number; top: number; from: number } => {
  const reach = anchor.radius * GROWN_RADIUS * 1.3 + GAP_PX
  const onLeft = anchor.x > innerWidth / 2
  const wanted = onLeft ? anchor.x - reach - PANEL_WIDTH : anchor.x + reach
  return {
    left: Math.max(EDGE_PX, Math.min(wanted, innerWidth - PANEL_WIDTH - EDGE_PX)),
    top: Math.max(EDGE_PX, Math.min(anchor.y - PANEL_HEIGHT, innerHeight - PANEL_HEIGHT - EDGE_PX)),
    from: onLeft ? -36 : 36,
  }
}

const handleSlot = (slot: CosmeticSlot) => useWardrobeStore.getState().selectSlot(slot)
const handleTry = (id: string) => useWardrobeStore.getState().tryOn(id)
const handleStopTrying = () => useWardrobeStore.getState().tryOn(null)

export function CompanionWardrobe() {
  const target = useWardrobeStore((store) => store.target)
  const slot = useWardrobeStore((store) => store.slot)
  const outfit = useAppearanceStore((store) => (target ? Object.values(store.projects).find((folder) => (folder.project ?? folder.path) === target.project)?.outfit : undefined))
  const panelRef = useRef<HTMLElement>(null)
  const [firstSlot] = useState(slot)
  const [switched, setSwitched] = useState(false)

  useLayoutEffect(() => {
    panelRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeWardrobe()
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        closeWardrobe()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  if (!target) {
    return null
  }
  const category = WARDROBE.find((candidate) => candidate.slot === slot) ?? WARDROBE[0]
  const { left, top, from } = placementOf(target)
  if (!switched && slot !== firstSlot) {
    setSwitched(true)
  }
  const handleWear = (id: string) => wearCosmetic(category.slot, id)
  const handleRemove = () => removeCosmetic(category.slot)

  return (
    <section
      ref={panelRef}
      role="region"
      aria-label="Garde-robe"
      tabIndex={-1}
      className="tily-wardrobe fixed flex flex-col overflow-hidden rounded-xl border border-tily-green/35 bg-tily-panel/95 shadow-[0_20px_50px_rgba(0,0,0,0.55)] outline-none"
      style={{ left, top, width: PANEL_WIDTH, height: PANEL_HEIGHT, zIndex: LAYER_ABOVE_COMPANIONS, '--tily-wardrobe-from': `${from}px` } as CSSProperties}
    >
      <header className="flex shrink-0 items-center gap-[10px] border-b border-tily-line px-[14px] py-[10px]">
        <h2 className="text-[14px] font-semibold text-tily-ink">Garde-robe</h2>
        <span className="truncate text-[12px] text-tily-muted">{target.name}</span>
        <button type="button" className={`${PANEL_HEADER_BUTTON} ml-auto`} aria-label="Fermer" data-tip="Fermer (Échap)" onClick={closeWardrobe}>
          <Icon name={IconName.Close} />
        </button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[124px_1fr]">
        <nav className="flex flex-col gap-[2px] border-r border-tily-line p-[6px]" aria-label="Catégories">
          {WARDROBE.map((candidate, index) => {
            const worn = outfit?.[candidate.slot]
            const handleSelect = () => handleSlot(candidate.slot)
            return (
              <button
                key={candidate.slot}
                type="button"
                aria-current={candidate.slot === slot}
                className="relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-[6px] text-left text-tily-ink-soft transition-colors hover:bg-tily-green-hover aria-[current=true]:bg-tily-green-soft aria-[current=true]:text-tily-ink"
                onClick={handleSelect}
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-tily-green-soft text-[11px] text-tily-green-deep">{index + 1}</span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold">{candidate.name}</span>
                  <span className="block truncate text-[10.5px] text-tily-muted">{candidate.items.find((item) => item.id === worn)?.name ?? '—'}</span>
                </span>
              </button>
            )
          })}
        </nav>
        <div className="min-w-0 overflow-y-auto px-3 py-[10px]">
          <h3 className="text-[13px] font-semibold text-tily-ink">{category.name}</h3>
          <p className="mt-[2px] mb-[9px] truncate text-[11.5px] text-tily-muted">{category.description}</p>
          <div key={category.slot} className="grid grid-cols-5 gap-[6px]" onPointerLeave={handleStopTrying}>
            {category.items.map((item, index) => (
              <CompanionWardrobeTile key={item.id} slot={category.slot} item={item} index={index} entering={!switched} hue={target.hue} seed={target.paneId} worn={outfit?.[category.slot] === item.id} onWear={handleWear} onTry={handleTry} />
            ))}
          </div>
        </div>
      </div>
      <footer className="flex shrink-0 items-center gap-[6px] border-t border-tily-line px-3 py-2">
        <span className="flex-1 text-[11.5px] text-tily-muted">Survoler pour essayer, cliquer pour porter</span>
        <button type="button" className={GIT_SECONDARY} onClick={handleRemove}>
          Retirer
        </button>
        <button type="button" className={GIT_SECONDARY} onClick={undress}>
          Tout retirer
        </button>
      </footer>
    </section>
  )
}
