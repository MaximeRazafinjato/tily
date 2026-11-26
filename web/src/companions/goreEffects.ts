import { impulse, ParticleKind, randomBetween, type Blob, type World } from './blobModel'

export const WALL_HURT_SPEED = 500
export const WALL_SPLAT_SPEED = 900
export const FLOOR_HURT_SPEED = 1000
export const FLOOR_SPLAT_SPEED = 1300
export const BLOOD_HUE = 352
export const HURT_S = 2.5
export const SAD_HEALTH = 0.34
const IMPACT_DAMAGE_PER_SPEED = 1 / 4000
const MAX_IMPACT_DAMAGE = 0.5
const SHOT_DAMAGE = 1 / 3
const SHAKE_DAMAGE = 0.02
const SHOT_RADIUS_MARGIN = 1.1
const SHOT_SIDE_SPEED: [number, number] = [450, 700]
const SHOT_LIFT_SPEED: [number, number] = [1100, 1400]
const MAX_DROPS = 240
const MAX_STAINS = 24
const STAIN_LIFE_S = 5
const HOLE_LIFE_S = 4
const SHAKE_WINDOW_MS = 1200
const SHAKE_MIN_SPEED = 600
const DIZZY_SHAKES = 4
const EXPLODE_SHAKES = 9
const DIZZY_S = 3
const REFORM_S = 3
const SNIPER_CLICKS = 5
const REGEN_DELAY_S = 8
const REGEN_PER_S = 0.15
const SNIPER_CLICK_WINDOW_MS = 2000

const spray = (world: World, x: number, y: number, count: number, angle: number, spread: number, speed: number): void => {
  const room = Math.max(0, MAX_DROPS - world.particles.filter((particle) => particle.kind === ParticleKind.Drop).length)
  for (let index = 0; index < Math.min(count, room); index++) {
    const direction = angle + randomBetween(-spread, spread)
    const velocity = randomBetween(speed * 0.3, speed)
    world.particles.push({ kind: ParticleKind.Drop, x, y, vx: Math.cos(direction) * velocity, vy: Math.sin(direction) * velocity, life: 1, hue: BLOOD_HUE, size: randomBetween(1.5, 4) })
  }
}

const decal = (world: World, kind: ParticleKind, x: number, y: number, size: number, lifetime: number): void => {
  const decals = world.particles.filter((particle) => particle.kind === ParticleKind.Stain || particle.kind === ParticleKind.Hole)
  if (decals.length >= MAX_STAINS) {
    world.particles = world.particles.filter((particle) => particle !== decals[0])
  }
  const spots = kind === ParticleKind.Stain
    ? Array.from({ length: 6 }, (): [number, number, number] => {
        const angle = randomBetween(0, Math.PI * 2)
        const distance = randomBetween(0.6, 1.5) * size
        return [Math.cos(angle) * distance, Math.sin(angle) * distance, randomBetween(0.15, 0.4) * size]
      })
    : []
  world.particles.push({ kind, x, y, vx: 0, vy: 0, life: 1, hue: BLOOD_HUE, size, spots, lifetime })
}

const explode = (world: World, blob: Blob): void => {
  const x = blob.x
  const y = blob.y - blob.radius
  spray(world, x, y, 60, -Math.PI / 2, Math.PI, 700)
  decal(world, ParticleKind.Stain, x, y, blob.radius * 1.2, STAIN_LIFE_S)
  const below = world.perches.filter((perch) => x >= perch.x1 && x <= perch.x2 && perch.y >= blob.y - 1).sort((a, b) => a.y - b.y)[0]
  blob.tomb = below ? { x, y: below.y, perch: below.element, alpha: 1 } : null
  blob.exploded = REFORM_S
  blob.dizzy = 0
  blob.vx = 0
  blob.vy = 0
  if (world.dragged === blob) {
    world.dragged = null
  }
}

const damage = (world: World, blob: Blob, amount: number): void => {
  if (blob.exploded > 0) {
    return
  }
  blob.health = Math.max(0, blob.health - amount)
  blob.hurt = HURT_S
  blob.sinceDamage = 0
  if (blob.health === 0) {
    explode(world, blob)
  }
}

export const regenerate = (blob: Blob, dt: number): void => {
  blob.sinceDamage += dt
  if (blob.sinceDamage > REGEN_DELAY_S && blob.health < 1) {
    blob.health = Math.min(1, blob.health + dt * REGEN_PER_S)
  }
}

export const reform = (blob: Blob): void => {
  blob.health = 1
  blob.hurt = 0
}

export const impact = (world: World, blob: Blob, x: number, y: number, angle: number, speed: number, hurtSpeed: number, splatSpeed: number): void => {
  if (!world.gore || speed < hurtSpeed) {
    return
  }
  if (speed >= splatSpeed) {
    const force = Math.min(2.5, speed / WALL_SPLAT_SPEED)
    spray(world, x, y, Math.round(14 * force), angle, 1.1, 260 * force)
    decal(world, ParticleKind.Stain, x, y, blob.radius * 0.45 * force, STAIN_LIFE_S)
    impulse(blob, 18 * force)
  }
  damage(world, blob, Math.min(MAX_IMPACT_DAMAGE, (speed - hurtSpeed) * IMPACT_DAMAGE_PER_SPEED + 0.05))
}

const SPARK_HUE = 45
const KICK_PX = 3
const KICK_MS = 120

const muzzle = (world: World, x: number, y: number): void => {
  world.recoil = 1
  world.flash = 1
  for (let index = 0; index < 10; index++) {
    const angle = randomBetween(0, Math.PI * 2)
    const speed = randomBetween(120, 420)
    world.particles.push({ kind: ParticleKind.Spark, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5, hue: SPARK_HUE, size: randomBetween(1.5, 3) })
  }
  document.getElementById('root')?.animate([{ transform: `translate(${KICK_PX}px, ${-KICK_PX}px)` }, { transform: 'none' }], { duration: KICK_MS, easing: 'ease-out' })
}

export const shoot = (world: World, x: number, y: number): void => {
  muzzle(world, x, y)
  const target = [...world.blobs].reverse().find((blob) => !blob.leaving && !blob.stored && blob.exploded === 0 && Math.hypot(x - blob.x, y - (blob.y - blob.radius)) < blob.radius * SHOT_RADIUS_MARGIN)
  if (!target) {
    decal(world, ParticleKind.Hole, x, y, 3, HOLE_LIFE_S)
    return
  }
  const direction = Math.sign(target.x - x) || (Math.random() < 0.5 ? -1 : 1)
  if (world.dragged === target) {
    world.dragged = null
  }
  target.perch = null
  target.vx = direction * randomBetween(...SHOT_SIDE_SPEED)
  target.vy = -randomBetween(...SHOT_LIFT_SPEED)
  impulse(target, 16)
  spray(world, x, y, 18, direction > 0 ? 0 : Math.PI, 0.9, 420)
  damage(world, target, SHOT_DAMAGE)
}

export const registerShake = (world: World, blob: Blob, now: number): void => {
  const [before, previous, last] = world.pointer.history.slice(-3)
  if (!world.gore || !before || !previous || !last || last.t === previous.t) {
    return
  }
  const speedOf = (from: { x: number; y: number; t: number }, to: { x: number; y: number; t: number }) => [((to.x - from.x) / Math.max(1, to.t - from.t)) * 1000, ((to.y - from.y) / Math.max(1, to.t - from.t)) * 1000]
  const [vx, vy] = speedOf(previous, last)
  const [previousVx, previousVy] = speedOf(before, previous)
  const reversed = (Math.sign(vx) !== Math.sign(previousVx) && Math.abs(vx) > SHAKE_MIN_SPEED) || (Math.sign(vy) !== Math.sign(previousVy) && Math.abs(vy) > SHAKE_MIN_SPEED)
  if (!reversed) {
    return
  }
  blob.shakes = [...blob.shakes.filter((time) => now - time < SHAKE_WINDOW_MS), now]
  spray(world, blob.x, blob.y - blob.radius, 3, Math.atan2(vy, vx), 0.6, 300)
  if (blob.shakes.length >= EXPLODE_SHAKES) {
    blob.shakes = []
    explode(world, blob)
    return
  }
  if (blob.shakes.length >= DIZZY_SHAKES) {
    blob.dizzy = DIZZY_S
  }
  damage(world, blob, SHAKE_DAMAGE)
}

export const countBasketClick = (world: World, now: number): void => {
  world.basketClicks = [...world.basketClicks.filter((time) => now - time < SNIPER_CLICK_WINDOW_MS), now]
  if (world.gore && world.basketClicks.length >= SNIPER_CLICKS) {
    world.basketClicks = []
    world.sniper = !world.sniper
  }
}
