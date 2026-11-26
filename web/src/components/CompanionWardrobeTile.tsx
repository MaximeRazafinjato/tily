import { memo, useEffect, useRef, type CSSProperties } from 'react'
import { TIER_LABELS, type CosmeticEntry, type CosmeticSlot } from '../companions/cosmetics/cosmeticCatalog'
import { startCosmeticPreview, type CosmeticPreview } from '../companions/wardrobePreview'

interface CompanionWardrobeTileProps {
  slot: CosmeticSlot
  item: CosmeticEntry
  index: number
  delay: number
  hue: number
  seed: string
  worn: boolean
  onWear: (id: string) => void
  onTry: (id: string) => void
}

const TIER_DOT: Record<string, string> = {
  common: 'bg-tily-tier-common',
  rare: 'bg-tily-tier-rare',
  legendary: 'bg-tily-tier-legendary shadow-[0_0_6px_var(--color-tily-tier-legendary)]',
}

export const CompanionWardrobeTile = memo(function CompanionWardrobeTile({ slot, item, index, delay, hue, seed, worn, onWear, onTry }: CompanionWardrobeTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<CosmeticPreview | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const timer = setTimeout(() => {
      previewRef.current = startCosmeticPreview(canvas, slot, { [slot]: item.id }, hue, seed)
    }, delay + index * 21)
    return () => {
      clearTimeout(timer)
      previewRef.current?.stop()
      previewRef.current = null
    }
  }, [slot, item.id, hue, seed, delay, index])

  const handleClick = () => onWear(item.id)
  const handleTry = () => {
    onTry(item.id)
    previewRef.current?.setActive(true)
  }
  const handleRest = () => previewRef.current?.setActive(false)
  const style = { '--tily-wardrobe-index': index, '--tily-wardrobe-delay': `${delay}ms` } as CSSProperties

  return (
    <button
      type="button"
      aria-pressed={worn}
      data-tip={`${item.name} · ${TIER_LABELS[item.tier]} — ${item.description}`}
      data-tier={item.tier}
      className={`tily-wardrobe-tile relative cursor-pointer overflow-hidden rounded-lg border bg-tily-terminal text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-tily-focus ${worn ? 'border-tily-green shadow-[0_0_0_1px_var(--color-tily-green)]' : item.tier === 'legendary' ? 'border-tily-tier-legendary/50' : 'border-tily-line hover:border-tily-muted'}`}
      style={style}
      onClick={handleClick}
      onPointerEnter={handleTry}
      onPointerLeave={handleRest}
      onFocus={handleTry}
      onBlur={handleRest}
    >
      <span className="relative block h-[66px]">
        <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />
        <span className={`absolute top-1 left-1 size-[7px] rounded-full ${TIER_DOT[item.tier]}`} />
        {worn && <span className="absolute top-[3px] right-[3px] grid size-[14px] place-items-center rounded-full bg-tily-green text-[9px] font-bold text-tily-paper">✓</span>}
      </span>
      <span className="block truncate bg-tily-panel px-1 py-[3px] text-center text-[10px] text-tily-ink-soft">{item.name}</span>
    </button>
  )
})
