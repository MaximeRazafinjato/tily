import type { AmbianceSettings } from '../bridge/appearanceMessages'
import { shouldRender } from '../ambiance/renderPacing'
import { useAgentStore } from '../store/agentStore'
import { useAppearanceStore } from '../store/appearanceStore'
import { useSessionStore } from '../store/sessionStore'
import { BlobMood, createWorld, resize, type World } from './blobModel'
import { updateBlob, updateParticles } from './blobPhysics'
import { drawBasket, drawBlob, drawParticles, drawReticle, drawStains, drawTombs } from './blobRenderer'
import { placeBasket, updateBasket } from './companionBasket'
import { startCompanionPointer } from './companionPointer'
import { updateSocial } from './companionSocial'
import { clearCompanions, syncCompanions } from './companionSync'

const LAYER_ID = 'tily-companions'
const LAYER_Z_INDEX = '2147482000'
const PERCH_REFRESH_MS = 400
const CALM_FRAME_MS = 50
const MAX_PIXEL_RATIO = 1.5
const MAX_STEP_S = 0.05
const FLOOR_TOLERANCE = 48
const SNIPER_CLASS = 'tily-companion-sniper'
const MODAL_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"]'

const companionsOf = (ambiance: AmbianceSettings | null) => (ambiance?.enabled && ambiance.companions.enabled ? ambiance.companions : null)

const pixelRatio = (): number => Math.min(devicePixelRatio, MAX_PIXEL_RATIO)

const isCalm = (world: World): boolean =>
  world.particles.length === 0 &&
  !world.dragged &&
  !world.sniper &&
  world.blobs.every((blob) => blob.stored || (blob.perch !== null && blob.mood === BlobMood.Idle && blob.grow >= 1 && !blob.leaving && blob.exploded === 0 && blob.yawn === 0 && !blob.highFiveWith && Math.abs(blob.squash) < 0.01 && Math.abs(blob.vx) < 1))

const readPerches = (world: World): void => {
  world.perches = [...document.querySelectorAll('[data-perch]')]
    .filter((element) => element.getClientRects().length > 0)
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return { element, x1: rect.left, x2: rect.right, y: rect.top }
    })
  if (!world.perches.some((perch) => perch.y >= world.height - FLOOR_TOLERANCE)) {
    world.perches.push({ element: null, x1: 0, x2: world.width, y: world.height })
  }
  placeBasket(world, document.querySelector('[data-basket]'))
  world.basket.color = getComputedStyle(document.documentElement).getPropertyValue('--color-tily-ink').trim() || world.basket.color
}

const fitLayer = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, world: World): void => {
  world.width = innerWidth
  world.height = innerHeight
  const ratio = pixelRatio()
  canvas.width = Math.round(world.width * ratio)
  canvas.height = Math.round(world.height * ratio)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
}

const draw = (context: CanvasRenderingContext2D, world: World, modalOpen: boolean): void => {
  context.clearRect(0, 0, world.width, world.height)
  if (modalOpen) {
    world.sniper = false
    document.documentElement.classList.remove(SNIPER_CLASS)
    return
  }
  drawStains(context, world)
  drawTombs(context, world)
  drawBasket(context, world)
  world.blobs
    .filter((blob) => !blob.stored)
    .sort((a, b) => Number(a === world.dragged) - Number(b === world.dragged) || b.radius - a.radius)
    .forEach((blob) => drawBlob(context, world, blob))
  drawParticles(context, world)
  drawReticle(context, world)
}

const mountLayer = (size: number, speed: number, gore: boolean): { world: World; stop: () => void } => {
  const canvas = document.createElement('canvas')
  canvas.id = LAYER_ID
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: LAYER_Z_INDEX, pointerEvents: 'none' })
  document.body.append(canvas)
  const context = canvas.getContext('2d')
  const world = createWorld(size, speed, gore)
  if (!context) {
    canvas.remove()
    return { world, stop: () => {} }
  }
  fitLayer(canvas, context, world)
  readPerches(world)
  syncCompanions(world)

  let previous = performance.now()
  let perchesReadAt = previous
  let frame = 0
  let modalOpen = false
  let calm = false
  let syncPending = false
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    const performanceSettings = useAppearanceStore.getState().ambiance?.performance
    if (document.hidden || (performanceSettings && !shouldRender(performanceSettings, now, previous))) {
      return
    }
    if (calm && !syncPending && now - previous < CALM_FRAME_MS) {
      return
    }
    const dt = Math.min(MAX_STEP_S, (now - previous) / 1000)
    previous = now
    if (now - perchesReadAt >= PERCH_REFRESH_MS) {
      perchesReadAt = now
      readPerches(world)
      modalOpen = document.querySelector(MODAL_SELECTOR) !== null
    }
    if (syncPending) {
      syncPending = false
      syncCompanions(world)
    }
    updateBasket(world)
    updateSocial(world, dt)
    ;[...world.blobs].forEach((blob) => updateBlob(world, blob, dt))
    updateParticles(world, dt)
    world.recoil = Math.max(0, world.recoil - dt * 6)
    world.flash = Math.max(0, world.flash - dt * 12)
    draw(context, world, modalOpen)
    calm = isCalm(world)
  }
  frame = requestAnimationFrame(tick)

  const handleResize = () => {
    fitLayer(canvas, context, world)
    readPerches(world)
  }
  const markSyncPending = () => {
    syncPending = true
  }
  addEventListener('resize', handleResize)
  const unsubscribes = [
    useAgentStore.subscribe((state, previous) => state.agents !== previous.agents && markSyncPending()),
    useSessionStore.subscribe((state, previous) => state.session !== previous.session && markSyncPending()),
    useAppearanceStore.subscribe((state, previous) => (state.projects !== previous.projects || state.ambiance !== previous.ambiance) && markSyncPending()),
  ]
  const stopPointer = startCompanionPointer(world)
  return {
    world,
    stop: () => {
      cancelAnimationFrame(frame)
      removeEventListener('resize', handleResize)
      unsubscribes.forEach((unsubscribe) => unsubscribe())
      stopPointer()
      clearCompanions(world)
      canvas.remove()
    },
  }
}

export const startCompanions = (): (() => void) => {
  let layer: { world: World; stop: () => void } | null = null
  const apply = (ambiance: AmbianceSettings | null) => {
    const companions = companionsOf(ambiance)
    if (!companions) {
      layer?.stop()
      layer = null
      return
    }
    if (!layer) {
      layer = mountLayer(companions.size, companions.speed / 100, companions.gore)
      return
    }
    layer.world.speed = companions.speed / 100
    layer.world.gore = companions.gore
    layer.world.sniper &&= companions.gore
    if (layer.world.size !== companions.size) {
      layer.world.size = companions.size
      resize(layer.world)
    }
  }
  apply(useAppearanceStore.getState().ambiance)
  const unsubscribe = useAppearanceStore.subscribe((state, previous) => {
    if (state.ambiance !== previous.ambiance) {
      apply(state.ambiance)
    }
  })
  return () => {
    unsubscribe()
    layer?.stop()
    layer = null
  }
}
