import type { CompanionOutfit } from '../bridge/appearanceMessages'
import type { Blob, World } from './blobModel'
import { easeInOutCubic, TAU } from './cosmetics/clayShapes'
import type { FigurePose } from './cosmetics/cosmeticState'

const FOCUS_S = 0.7
const GROWTH = 0.8
const BUMP_S = 0.3
const RING_DECAY = 2.4
const BACK_OVERSHOOT = 1.2 * 1.525
const EDGE_ROOM = 1.15
const SLIDE_RATE = 8

const easeInOutBack = (progress: number): number =>
  progress < 0.5
    ? ((2 * progress) ** 2 * ((BACK_OVERSHOOT + 1) * 2 * progress - BACK_OVERSHOOT)) / 2
    : ((2 * progress - 2) ** 2 * ((BACK_OVERSHOOT + 1) * (progress * 2 - 2) + BACK_OVERSHOOT) + 2) / 2

export const focusedBlob = (world: World): Blob | undefined => (world.focus ? world.blobs.find((blob) => blob.key === world.focus?.key && !blob.parent && !blob.leaving) : undefined)

export const isFocused = (world: World, blob: Blob): boolean => world.focus?.key === blob.key && !blob.parent

export const outfitOf = (world: World, blob: Blob): CompanionOutfit => (isFocused(world, blob) && world.focus?.preview ? world.focus.preview : blob.outfit)

const progressOf = (world: World, blob: Blob): number => (isFocused(world, blob) ? (world.focus?.progress ?? 0) : 0)

export const focusScale = (world: World, blob: Blob): number => 1 + GROWTH * easeInOutBack(progressOf(world, blob))

export const focusHomeX = (world: World, blob: Blob): number => {
  const room = blob.radius * (1 + GROWTH) * EDGE_ROOM
  return Math.min(Math.max(blob.x, room), Math.max(room, world.width - room))
}

export const openFocus = (world: World, blob: Blob): void => {
  world.focus = { key: blob.key, homeX: focusHomeX(world, blob), open: true, progress: world.focus?.key === blob.key ? world.focus.progress : 0, bumpAt: -Infinity, ring: 0, preview: null }
  blob.vx = 0
  blob.targetX = blob.x
}

export const closeFocus = (world: World): void => {
  if (world.focus) {
    world.focus.open = false
    world.focus.preview = null
  }
}

export const bumpFocus = (world: World): void => {
  const blob = focusedBlob(world)
  if (world.focus && blob) {
    world.focus.bumpAt = blob.clock
  }
}

export const updateFocus = (world: World, dt: number): void => {
  const focus = world.focus
  if (!focus) {
    return
  }
  const blob = focusedBlob(world)
  if (!blob) {
    world.focus = null
    return
  }
  if (focus.open) {
    blob.x += (focus.homeX - blob.x) * Math.min(1, dt * SLIDE_RATE)
    blob.targetX = blob.x
  }
  const previous = focus.progress
  focus.progress = Math.min(1, Math.max(0, focus.progress + ((focus.open ? 1 : -1) * dt) / FOCUS_S))
  if (focus.open && previous < 1 && focus.progress >= 1) {
    focus.ring = 1
  }
  focus.ring = Math.max(0, focus.ring - dt * RING_DECAY)
  if (!focus.open && focus.progress === 0) {
    world.focus = null
  }
}

export const focusPose = (world: World, blob: Blob, pose: FigurePose, radius: number): FigurePose => {
  const focus = world.focus
  if (!focus || !isFocused(world, blob)) {
    return pose
  }
  const bump = (blob.clock - focus.bumpAt) / BUMP_S
  const squash = bump >= 0 && bump < 1 ? 0.09 * Math.sin(bump * Math.PI * 2) * (1 - bump) : 0
  const arc = Math.sin(focus.progress * Math.PI)
  return {
    ...pose,
    rotation: pose.rotation * (1 - arc) + TAU * easeInOutCubic(focus.progress),
    dy: pose.dy - arc * radius * 0.3,
    sx: pose.sx * (1 + squash),
    sy: pose.sy * (1 - squash),
  }
}

export const drawFocusBehind = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number): void => {
  const progress = progressOf(world, blob)
  if (progress <= 0) {
    return
  }
  const strength = progress * progress * (3 - 2 * progress)
  const centerY = blob.y - radius
  const glow = context.createRadialGradient(blob.x, centerY, 0, blob.x, centerY, radius * 2.6)
  glow.addColorStop(0, `hsla(${blob.hue}, 90%, 65%, ${0.24 * strength})`)
  glow.addColorStop(1, `hsla(${blob.hue}, 90%, 65%, 0)`)
  context.fillStyle = glow
  context.fillRect(blob.x - radius * 2.6, centerY - radius * 2.6, radius * 5.2, radius * 5.2)
  context.fillStyle = `hsla(${blob.hue}, 90%, 65%, ${0.28 * strength})`
  context.beginPath()
  context.ellipse(blob.x, blob.y + 3, radius * 1.3, 5, 0, 0, TAU)
  context.fill()
}

export const drawFocusFront = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number): void => {
  const focus = world.focus
  if (!focus || !isFocused(world, blob)) {
    return
  }
  const centerY = blob.y - radius
  context.save()
  context.lineCap = 'round'
  if (focus.progress > 0 && focus.progress < 1) {
    const swing = Math.sin(focus.progress * Math.PI)
    const base = TAU * easeInOutCubic(focus.progress) * 1.4
    context.strokeStyle = `rgba(255, 255, 255, ${swing * 0.55})`
    context.lineWidth = 2.5
    for (let index = 0; index < 3; index++) {
      const start = base + (index * TAU) / 3
      context.beginPath()
      context.arc(blob.x, centerY, radius * (1.3 + index * 0.12), start, start + 1.1 * swing)
      context.stroke()
    }
  }
  if (focus.ring > 0) {
    context.strokeStyle = `hsla(${blob.hue}, 90%, 78%, ${focus.ring * 0.7})`
    context.lineWidth = 3 * focus.ring + 1
    context.beginPath()
    context.arc(blob.x, centerY, radius * (1.15 + (1 - focus.ring) * 1.1), 0, TAU)
    context.stroke()
  }
  context.restore()
}
