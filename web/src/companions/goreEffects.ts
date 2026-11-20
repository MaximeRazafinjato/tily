import { impulse, ParticleKind, randomBetween, type Blob, type World } from './blobModel'

export const WALL_SPLAT_SPEED = 900
export const FLOOR_SPLAT_SPEED = 1300
const MAX_DROPS = 240
const MAX_STAINS = 24
const STAIN_LIFE_S = 5
const SHAKE_WINDOW_MS = 1200
const SHAKE_MIN_SPEED = 600
const DIZZY_SHAKES = 4
const EXPLODE_SHAKES = 9
const DIZZY_S = 3
const REFORM_S = 3
export const BLOOD_HUE = 352

const spray = (world: World, x: number, y: number, count: number, angle: number, spread: number, speed: number): void => {
  const room = Math.max(0, MAX_DROPS - world.particles.filter((particle) => particle.kind === ParticleKind.Drop).length)
  for (let index = 0; index < Math.min(count, room); index++) {
    const direction = angle + randomBetween(-spread, spread)
    const velocity = randomBetween(speed * 0.3, speed)
    world.particles.push({ kind: ParticleKind.Drop, x, y, vx: Math.cos(direction) * velocity, vy: Math.sin(direction) * velocity, life: 1, hue: BLOOD_HUE, size: randomBetween(1.5, 4) })
  }
}

const stain = (world: World, x: number, y: number, size: number): void => {
  const stains = world.particles.filter((particle) => particle.kind === ParticleKind.Stain)
  if (stains.length >= MAX_STAINS) {
    world.particles = world.particles.filter((particle) => particle !== stains[0])
  }
  const spots = Array.from({ length: 6 }, (): [number, number, number] => {
    const angle = randomBetween(0, Math.PI * 2)
    const distance = randomBetween(0.6, 1.5) * size
    return [Math.cos(angle) * distance, Math.sin(angle) * distance, randomBetween(0.15, 0.4) * size]
  })
  world.particles.push({ kind: ParticleKind.Stain, x, y, vx: 0, vy: 0, life: 1, hue: BLOOD_HUE, size, spots, lifetime: STAIN_LIFE_S })
}

export const splat = (world: World, blob: Blob, x: number, y: number, angle: number, speed: number): void => {
  if (!world.gore) {
    return
  }
  const force = Math.min(2.5, speed / WALL_SPLAT_SPEED)
  spray(world, x, y, Math.round(14 * force), angle, 1.1, 260 * force)
  stain(world, x, y, blob.radius * 0.45 * force)
  impulse(blob, 18 * force)
}

const explode = (world: World, blob: Blob): void => {
  const x = blob.x
  const y = blob.y - blob.radius
  spray(world, x, y, 60, -Math.PI / 2, Math.PI, 700)
  stain(world, x, y, blob.radius * 1.2)
  blob.exploded = REFORM_S
  blob.dizzy = 0
  blob.vx = 0
  blob.vy = 0
  if (world.dragged === blob) {
    world.dragged = null
  }
}

export const registerShake = (world: World, blob: Blob, now: number): void => {
  const [previous, last] = world.pointer.history.slice(-2)
  const before = world.pointer.history.at(-3)
  if (!world.gore || !previous || !last || !before || last.t === previous.t) {
    return
  }
  const vx = ((last.x - previous.x) / (last.t - previous.t)) * 1000
  const previousVx = ((previous.x - before.x) / Math.max(1, previous.t - before.t)) * 1000
  const vy = ((last.y - previous.y) / (last.t - previous.t)) * 1000
  const previousVy = ((previous.y - before.y) / Math.max(1, previous.t - before.t)) * 1000
  const reversed = (Math.sign(vx) !== Math.sign(previousVx) && Math.abs(vx) > SHAKE_MIN_SPEED) || (Math.sign(vy) !== Math.sign(previousVy) && Math.abs(vy) > SHAKE_MIN_SPEED)
  if (!reversed) {
    return
  }
  blob.shakes = [...blob.shakes.filter((time) => now - time < SHAKE_WINDOW_MS), now]
  spray(world, blob.x, blob.y - blob.radius, 3, Math.atan2(vy, vx), 0.6, 300)
  if (blob.shakes.length >= EXPLODE_SHAKES) {
    blob.shakes = []
    explode(world, blob)
  } else if (blob.shakes.length >= DIZZY_SHAKES) {
    blob.dizzy = DIZZY_S
  }
}
