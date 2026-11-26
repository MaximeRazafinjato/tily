import { joinPane } from '../terminal/terminalActions'
import { clamp, impulse, type Blob, type World } from './blobModel'
import { ballAt, grabBall, releaseBall, spawnBall, vanishBall } from './companionBall'
import { insideBasket, releaseStored, storeBlob } from './companionBasket'
import { countBasketClick, registerShake, shoot } from './goreEffects'
import { petBlob } from './companionSocial'
import { isFocused } from './wardrobeFocus'
import { openWardrobeFor } from './wardrobeLink'

const HISTORY_LENGTH = 6
const CLICK_DISTANCE = 3
const THROW_LIMIT = 1400
const POKE_S = 0.8
const HOVER_CLASS = 'tily-companion-hover'
const DRAG_CLASS = 'tily-companion-drag'
const SNIPER_CLASS = 'tily-companion-sniper'
const CURSOR_STYLE = `html.${HOVER_CLASS}, html.${HOVER_CLASS} * { cursor: grab !important } html.${DRAG_CLASS}, html.${DRAG_CLASS} * { cursor: grabbing !important } html.${SNIPER_CLASS}, html.${SNIPER_CLASS} * { cursor: none !important }`

const blobAt = (world: World, x: number, y: number): Blob | undefined =>
  [...world.blobs].reverse().find((blob) => !blob.leaving && !blob.stored && blob.exploded === 0 && Math.hypot(x - blob.x, y - (blob.y - blob.radius)) < blob.radius * 1.05)

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
    if (blob.demo === 0) {
      joinPane(blob.paneId)
    }
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
    const onBasket = insideBasket(world, event.clientX, event.clientY)
    if (world.sniper && !onBasket) {
      event.preventDefault()
      event.stopPropagation()
      shoot(world, event.clientX, event.clientY)
      return
    }
    if (world.ball && ballAt(world, event.clientX, event.clientY)) {
      event.preventDefault()
      event.stopPropagation()
      world.pointer.history = []
      document.documentElement.setPointerCapture(event.pointerId)
      grabBall(world.ball)
      document.documentElement.classList.add(DRAG_CLASS)
      return
    }
    const hit = blobAt(world, event.clientX, event.clientY)
    if (!hit && !onBasket) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (hit && isFocused(world, hit.parent ?? hit)) {
      return
    }
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
    const [previous, last] = pointer.history.slice(-2)
    if (previous && last && last.t > previous.t) {
      world.pointerSpeed = (Math.hypot(last.x - previous.x, last.y - previous.y) / (last.t - previous.t)) * 1000
    }
    if (world.dragged) {
      registerShake(world, world.dragged, performance.now())
    }
    world.hovered = world.dragged ? null : (blobAt(world, pointer.x, pointer.y) ?? null)
    if (world.hovered && event.buttons === 0 && !world.sniper && previous && last) {
      petBlob(world, world.hovered, Math.hypot(last.x - previous.x, last.y - previous.y))
    }
    const hovering = !world.dragged && !world.ball?.held && (world.hovered !== null || insideBasket(world, pointer.x, pointer.y) || ballAt(world, pointer.x, pointer.y))
    document.documentElement.classList.toggle(HOVER_CLASS, hovering && !world.sniper)
    document.documentElement.classList.toggle(SNIPER_CLASS, world.sniper)
  }

  const handlePointerUp = (event: PointerEvent) => {
    document.documentElement.classList.remove(DRAG_CLASS)
    if (world.basket.pressed) {
      world.basket.pressed = false
      if (insideBasket(world, event.clientX, event.clientY)) {
        vanishBall(world)
        countBasketClick(world, performance.now())
        document.documentElement.classList.toggle(SNIPER_CLASS, world.sniper)
        releaseStored(world)
      }
      return
    }
    if (world.ball?.held) {
      const { vx, vy } = throwVelocity(world)
      if (world.basket.hover) {
        world.ball = null
      } else {
        releaseBall(world.ball, vx, vy)
      }
      return
    }
    if (world.dragged) {
      release(world, world.dragged)
    }
  }

  const handleContextMenu = (event: MouseEvent) => {
    if (insideBasket(world, event.clientX, event.clientY)) {
      event.preventDefault()
      event.stopPropagation()
      spawnBall(world)
      return
    }
    const hit = world.sniper ? undefined : blobAt(world, event.clientX, event.clientY)
    if (hit) {
      event.preventDefault()
      event.stopPropagation()
      openWardrobeFor(world, hit)
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (world.sniper && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      world.sniper = false
      document.documentElement.classList.remove(SNIPER_CLASS)
    }
  }

  document.addEventListener('pointerdown', handlePointerDown, true)
  document.addEventListener('keydown', handleKeyDown, true)
  document.addEventListener('contextmenu', handleContextMenu, true)
  addEventListener('pointermove', handlePointerMove)
  addEventListener('pointerup', handlePointerUp)
  addEventListener('pointercancel', handlePointerUp)
  return () => {
    document.removeEventListener('pointerdown', handlePointerDown, true)
    document.removeEventListener('keydown', handleKeyDown, true)
    document.removeEventListener('contextmenu', handleContextMenu, true)
    removeEventListener('pointermove', handlePointerMove)
    removeEventListener('pointerup', handlePointerUp)
    removeEventListener('pointercancel', handlePointerUp)
    document.documentElement.classList.remove(HOVER_CLASS, DRAG_CLASS, SNIPER_CLASS)
    style.remove()
  }
}
