import type { CompanionOutfit } from '../bridge/appearanceMessages'
import { BlobMood, createBlob, createWorld, type Blob, type World } from './blobModel'
import { updateBlob } from './blobPhysics'
import { drawBlob } from './blobRenderer'
import { CosmeticSlot } from './cosmetics/cosmeticCatalog'
import { drawTrails, updateCosmetics } from './cosmetics/trailEffects'

const MAX_STEP_S = 0.05
const FLOOR_PX = 9
const MAX_PIXEL_RATIO = 2
const RADIUS: Record<CosmeticSlot, number> = {
  [CosmeticSlot.Hat]: 12,
  [CosmeticSlot.Face]: 16,
  [CosmeticSlot.Skin]: 15,
  [CosmeticSlot.Trail]: 11,
  [CosmeticSlot.Animation]: 11,
}
const MOVING = new Set([CosmeticSlot.Trail, CosmeticSlot.Animation])
const WARMUP_STEPS = 45
const WARMUP_STEP_S = 1 / 30

interface Preview {
  canvas: HTMLCanvasElement
  world: World
  blob: Blob
  moving: boolean
  active: boolean
}

export interface CosmeticPreview {
  setActive: (active: boolean) => void
  stop: () => void
}

const previews = new Set<Preview>()
let frame = 0
let previous = 0

const perch = document.createElement('span')

const fit = (preview: Preview): CanvasRenderingContext2D | null => {
  const { canvas, world } = preview
  const ratio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO)
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height) {
    return null
  }
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
  }
  world.width = width
  world.height = height
  world.perches = [{ element: perch, x1: 0, x2: width, y: height - FLOOR_PX }]
  const context = canvas.getContext('2d')
  context?.setTransform(ratio, 0, 0, ratio, 0, 0)
  return context
}

const simulate = (preview: Preview, dt: number): void => {
  const { world, blob } = preview
  world.clock += dt
  if (!preview.moving) {
    blob.x = world.width / 2
    blob.vx = 0
  }
  updateBlob(world, blob, dt)
  updateCosmetics(world, dt)
}

const paint = (preview: Preview): void => {
  const context = fit(preview)
  if (!context) {
    return
  }
  const { world, blob } = preview
  context.clearRect(0, 0, world.width, world.height)
  drawTrails(context, world)
  drawBlob(context, world, blob)
}

const tick = (now: number): void => {
  const dt = Math.min(MAX_STEP_S, (now - previous) / 1000)
  previous = now
  const active = [...previews].filter((preview) => preview.active)
  active.forEach((preview) => {
    simulate(preview, dt)
    paint(preview)
  })
  frame = active.length ? requestAnimationFrame(tick) : 0
}

const wake = (): void => {
  if (!frame) {
    previous = performance.now()
    frame = requestAnimationFrame(tick)
  }
}

export const startCosmeticPreview = (canvas: HTMLCanvasElement, slot: CosmeticSlot, outfit: CompanionOutfit, hue: number, seed: string): CosmeticPreview => {
  const world = createWorld(RADIUS[slot], 0.8, false)
  world.sleepAfter = Infinity
  world.width = canvas.clientWidth
  world.height = canvas.clientHeight
  const blob = createBlob(world, seed, seed, hue, null)
  const moving = MOVING.has(slot)
  Object.assign(blob, { outfit, grow: 1, x: world.width / 2, y: world.height - FLOOR_PX, perch, mood: moving ? BlobMood.Working : BlobMood.Idle, targetX: world.width / 2 })
  world.blobs = [blob]
  const preview: Preview = { canvas, world, blob, moving, active: false }
  previews.add(preview)
  if (fit(preview)) {
    for (let index = 0; index < WARMUP_STEPS; index++) {
      simulate(preview, WARMUP_STEP_S)
    }
  }
  paint(preview)
  return {
    setActive: (active) => {
      preview.active = active
      if (active) {
        wake()
      }
    },
    stop: () => {
      previews.delete(preview)
    },
  }
}
