import { joinPane } from '../terminal/terminalActions'
import { clamp, impulse, type Blob, type World } from './blobModel'
import { insideBasket, releaseStored, storeBlob } from './companionBasket'

const HISTORY_LENGTH = 6
const CLICK_DISTANCE = 3
const THROW_LIMIT = 1400
const POKE_S = 0.8
const HOVER_CLASS = 'tily-companion-hover'
const DRAG_CLASS = 'tily-companion-drag'
const CURSOR_STYLE = `html.${HOVER_CLASS}, html.${HOVER_CLASS} * { cursor: grab !important } html.${DRAG_CLASS}, html.${DRAG_CLASS} * { cursor: grabbing !important }`

const blobAt = (world: World, x: number, y: number): Blob | undefined =>
  [...world.blobs].reverse().find((blob) => !blob.leaving && !blob.stored && Math.hypot(x - blob.x, y - (blob.y - blob.radius)) < blob.radius * 1.05)

const throwVelocity = (world: World): { vx: number; vy: number; moved: number } => {
  const { history } = world.pointer
  const first = history[0]
  const last = history.at(-1)
  const elapsed = first && last ? (last.t - first.t) / 1000 : 0
  if (!first || !last || elapsed <= 0) {
    return { vx: 0, vy: 0, moved: 0 }
  }
  return {
    vx: clamp((last.x - first.x) / elapsed, -THROW_LIMIT, THROW_LIMIT),
    vy: clamp((last.y - first.y) / elapsed, -THROW_LIMIT, THROW_LIMIT),
    moved: Math.hypot(last.x - first.x, last.y - first.y),
  }
}

const release = (world: World, blob: Blob): void => {
  world.dragged = null
  document.documentElement.classList.remove(DRAG_CLASS)
  if (world.basket.hover) {
    storeBlob(blob)
    return
  }
  const { vx, vy, moved } = throwVelocity(world)
  blob.targetX = blob.x
  blob.vx = vx
  blob.vy = vy
  if (moved < CLICK_DISTANCE) {
    blob.poke = POKE_S
    joinPane(blob.paneId)
  }
}

export const startCompanionPointer = (world: World): (() => void) => {
  const style = document.createElement('style')
  style.textContent = CURSOR_STYLE
  document.head.append(style)

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return
    }
    const hit = blobAt(world, event.clientX, event.clientY)
    if (!hit && !insideBasket(world, event.clientX, event.clientY)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    world.pointer.history = []
    document.documentElement.setPointerCapture(event.pointerId)
    if (!hit) {
      world.basket.pressed = true
      return
    }
    world.dragged = hit
    hit.perch = null
    hit.vx = 0
    hit.vy = 0
    hit.idleTime = 0
    impulse(hit, -10)
    document.documentElement.classList.add(DRAG_CLASS)
  }

  const handlePointerMove = (event: PointerEvent) => {
    const { pointer } = world
    pointer.x = event.clientX
    pointer.y = event.clientY
    pointer.history.push({ x: pointer.x, y: pointer.y, t: performance.now() })
    if (pointer.history.length > HISTORY_LENGTH) {
      pointer.history.shift()
    }
    const hovering = !world.dragged && (blobAt(world, pointer.x, pointer.y) !== undefined || insideBasket(world, pointer.x, pointer.y))
    document.documentElement.classList.toggle(HOVER_CLASS, hovering)
  }

  const handlePointerUp = (event: PointerEvent) => {
    document.documentElement.classList.remove(DRAG_CLASS)
    if (world.basket.pressed) {
      world.basket.pressed = false
      if (insideBasket(world, event.clientX, event.clientY)) {
        releaseStored(world)
      }
      return
    }
    if (world.dragged) {
      release(world, world.dragged)
    }
  }

  document.addEventListener('pointerdown', handlePointerDown, true)
  addEventListener('pointermove', handlePointerMove)
  addEventListener('pointerup', handlePointerUp)
  addEventListener('pointercancel', handlePointerUp)
  return () => {
    document.removeEventListener('pointerdown', handlePointerDown, true)
    removeEventListener('pointermove', handlePointerMove)
    removeEventListener('pointerup', handlePointerUp)
    removeEventListener('pointercancel', handlePointerUp)
    document.documentElement.classList.remove(HOVER_CLASS, DRAG_CLASS)
    style.remove()
  }
}
