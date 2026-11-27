import type { AmbianceSettings } from '../bridge/appearanceMessages'
import { shouldRender } from '../ambiance/renderPacing'
import { useAgentStore } from '../store/agentStore'
import { useAppearanceStore } from '../store/appearanceStore'
import { useFeatureFlagStore } from '../store/featureFlagStore'
import { useSessionStore } from '../store/sessionStore'
import { BlobMood, createWorld, resize, type World } from './blobModel'
import { updateBlob, updateParticles } from './blobPhysics'
import { drawBall, drawBasket, drawBlob, drawParticles, drawReticle, drawStains, drawTombs } from './blobRenderer'
import { updateBall } from './companionBall'
import { placeBasket, updateBasket } from './companionBasket'
import { overlayOpen, startCompanionPointer } from './companionPointer'
import { updateSocial } from './companionSocial'
import { clearCompanions, syncCompanions } from './companionSync'
import { cosmeticsActive, drawTrails, updateCosmetics } from './cosmetics/trailEffects'
import { isFocused, updateFocus } from './wardrobeFocus'
import { keepWardrobeLinked, linkWardrobe } from './wardrobeLink'
import { shinyDemoRequested, takeShinyDemo } from './shinyDemo'
import { spawnShinyDemo } from './shinyEffects'

const LAYER_ID = 'tily-companions'
const LAYER_Z_INDEX = '15'
const PERCH_REFRESH_MS = 400
const CALM_FRAME_MS = 50
const MAX_PIXEL_RATIO = 1.5
const MAX_STEP_S = 0.05
const FLOOR_TOLERANCE = 48
const SNIPER_CLASS = 'tily-companion-sniper'
const HOST_SELECTOR = '[data-companion-host]'

const companionsOf = (ambiance: AmbianceSettings | null) => (ambiance?.enabled && ambiance.companions.enabled ? ambiance.companions : null)

const pixelRatio = (): number => Math.min(devicePixelRatio, MAX_PIXEL_RATIO)

const isCalm = (world: World): boolean =>
  world.particles.length === 0 &&
  !cosmeticsActive(world) &&
  !world.ball &&
  !world.dragged &&
  !world.sniper &&
  world.blobs.every((blob) => blob.stored || (blob.perch !== null && blob.mood === BlobMood.Idle && blob.grow >= 1 && !blob.leaving && blob.exploded === 0 && blob.yawn === 0 && !blob.highFiveWith && Math.abs(blob.squash) < 0.01 && Math.abs(blob.vx) < 1))

const insideViewport = (element: Element, y: number): boolean => {
  const viewport = element.closest('[data-perch-viewport]')
  if (!viewport) {
    return true
  }
  const bounds = viewport.getBoundingClientRect()
  return y >= bounds.top && y <= bounds.bottom
}

const readPerches = (world: World): void => {
  world.perches = [...document.querySelectorAll('[data-perch]')]
    .filter((element) => element.getClientRects().length > 0)
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return { element, x1: rect.left, x2: rect.right, y: rect.top }
    })
    .filter((perch) => insideViewport(perch.element, perch.y))
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

const attachLayer = (canvas: HTMLCanvasElement): void => {
  const host = document.querySelector(HOST_SELECTOR) ?? document.body
  if (canvas.parentElement !== host) {
    host.append(canvas)
  }
}

const draw = (context: CanvasRenderingContext2D, world: World): void => {
  context.clearRect(0, 0, world.width, world.height)
  drawStains(context, world)
  drawTombs(context, world)
  drawBasket(context, world)
  drawTrails(context, world)
  world.blobs
    .filter((blob) => !blob.stored)
    .sort((a, b) => Number(a === world.dragged) - Number(b === world.dragged) || Number(isFocused(world, a)) - Number(isFocused(world, b)) || b.radius - a.radius)
    .forEach((blob) => drawBlob(context, world, blob))
  drawBall(context, world)
  drawParticles(context, world)
  drawReticle(context, world)
}

const mountLayer = (size: number, speed: number, gore: boolean): { world: World; stop: () => void } => {
  const canvas = document.createElement('canvas')
  canvas.id = LAYER_ID
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: LAYER_Z_INDEX, pointerEvents: 'none' })
  attachLayer(canvas)
  const context = canvas.getContext('2d')
  const world = createWorld(size, speed, gore)
  if (!context) {
    canvas.remove()
    return { world, stop: () => {} }
  }
  let basketAnchor: Element | null = null
  let layoutChanged = false
  const basketObserver = new ResizeObserver(() => {
    readPerches(world)
    layoutChanged = true
  })
  const readSurfaces = () => {
    attachLayer(canvas)
    readPerches(world)
    const anchor = document.querySelector('[data-basket]')
    if (anchor !== basketAnchor) {
      basketObserver.disconnect()
      basketAnchor = anchor
      if (anchor) {
        basketObserver.observe(anchor)
      }
    }
  }
  fitLayer(canvas, context, world)
  readSurfaces()
  syncCompanions(world)

  let previous = performance.now()
  let perchesReadAt = previous
  let frame = 0
  let calm = false
  let syncPending = false
  let scrolled = false
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    const performanceSettings = useAppearanceStore.getState().ambiance?.performance
    if (document.hidden || (performanceSettings && !shouldRender(performanceSettings, now, previous))) {
      return
    }
    if (calm && !syncPending && !layoutChanged && now - previous < CALM_FRAME_MS) {
      return
    }
    const dt = Math.min(MAX_STEP_S, (now - previous) / 1000)
    previous = now
    layoutChanged = false
    if (scrolled) {
      scrolled = false
      readPerches(world)
    }
    if (now - perchesReadAt >= PERCH_REFRESH_MS) {
      perchesReadAt = now
      readSurfaces()
      if (world.sniper && overlayOpen()) {
        world.sniper = false
        document.documentElement.classList.remove(SNIPER_CLASS)
      }
    }
    if (syncPending) {
      syncPending = false
      syncCompanions(world)
    }
    if (shinyDemoRequested() && !overlayOpen() && takeShinyDemo()) {
      spawnShinyDemo(world)
    }
    updateBasket(world)
    updateSocial(world, dt)
    ;[...world.blobs].forEach((blob) => updateBlob(world, blob, dt))
    updateBall(world, dt)
    updateParticles(world, dt)
    updateFocus(world, dt)
    keepWardrobeLinked(world)
    updateCosmetics(world, dt)
    world.recoil = Math.max(0, world.recoil - dt * 6)
    world.flash = Math.max(0, world.flash - dt * 12)
    draw(context, world)
    calm = isCalm(world)
  }
  frame = requestAnimationFrame(tick)

  const handleResize = () => {
    fitLayer(canvas, context, world)
    readSurfaces()
  }
  const markSyncPending = () => {
    syncPending = true
  }
  const handleScroll = () => {
    scrolled = true
    layoutChanged = true
  }
  addEventListener('resize', handleResize)
  document.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  const unsubscribes = [
    useAgentStore.subscribe((state, previous) => state.agents !== previous.agents && markSyncPending()),
    useSessionStore.subscribe((state, previous) => state.session !== previous.session && markSyncPending()),
    useAppearanceStore.subscribe((state, previous) => (state.projects !== previous.projects || state.ambiance !== previous.ambiance) && markSyncPending()),
    useFeatureFlagStore.subscribe((state, previous) => state.flags !== previous.flags && markSyncPending()),
  ]
  const stopPointer = startCompanionPointer(world)
  const stopWardrobe = linkWardrobe(world)
  return {
    world,
    stop: () => {
      cancelAnimationFrame(frame)
      basketObserver.disconnect()
      removeEventListener('resize', handleResize)
      document.removeEventListener('scroll', handleScroll, { capture: true })
      unsubscribes.forEach((unsubscribe) => unsubscribe())
      stopPointer()
      stopWardrobe()
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
