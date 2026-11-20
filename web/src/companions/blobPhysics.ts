import { FLOOR_SPLAT_SPEED, splat, WALL_SPLAT_SPEED } from './goreEffects'
import { BlobMood, targetRadius, clamp, DONE_CELEBRATION_S, GRAVITY, impulse, jump, lerp, ParticleKind, randomBetween, removeBlob, setMood, SLEEP_AFTER_S, type Blob, type Perch, type World } from './blobModel'

const SPRING_STIFFNESS = 180
const SPRING_DAMPING = 9
const LOOK_RANGE = 320
const ARRIVAL_DISTANCE = 8

const perchOf = (world: World, blob: Blob): Perch | undefined => world.perches.find((perch) => perch.element === blob.perch)

const land = (world: World, blob: Blob, previousY: number): void => {
  if (blob.vy < 0) {
    return
  }
  const landing = world.perches
    .filter((perch) => blob.x >= perch.x1 && blob.x <= perch.x2 && perch.y >= previousY - 0.5 && perch.y <= blob.y)
    .sort((a, b) => a.y - b.y)[0]
  if (!landing) {
    return
  }
  if (blob.vy > FLOOR_SPLAT_SPEED) {
    splat(world, blob, blob.x, landing.y, -Math.PI / 2, blob.vy)
  }
  if (blob.vy > 300) {
    impulse(blob, Math.min(blob.vy / 70, 14))
  }
  blob.y = landing.y
  blob.vy = 0
  blob.vx *= 0.2
  blob.perch = landing.element
}

const walk = (world: World, blob: Blob, dt: number, perch: Perch): void => {
  const returning = blob.leaving && blob.parent !== null
  blob.hopTimer -= dt * (returning ? 1 : world.speed)
  if (blob.hopTimer > 0) {
    return
  }
  const min = perch.x1 + blob.radius
  const max = perch.x2 - blob.radius
  if (returning && blob.parent) {
    blob.targetX = clamp(blob.parent.x, min, max)
  } else if (Math.abs(blob.targetX - blob.x) < ARRIVAL_DISTANCE || blob.targetX < min || blob.targetX > max) {
    const arrived = Math.abs(blob.targetX - blob.x) < ARRIVAL_DISTANCE
    const around = blob.parent ? blob.parent.x + randomBetween(-140, 140) : randomBetween(min, max)
    blob.targetX = max <= min ? (perch.x1 + perch.x2) / 2 : clamp(around, min, max)
    if (arrived) {
      blob.hopTimer = randomBetween(1.5, 4)
      return
    }
  }
  if (Math.abs(blob.targetX - blob.x) > 4) {
    blob.vx = Math.sign(blob.targetX - blob.x) * (returning ? 320 : randomBetween(70, 110) * world.speed)
    jump(world, blob, returning ? 420 : randomBetween(200, 260))
    blob.hopTimer = randomBetween(0.25, 0.5)
  }
}

const fall = (world: World, blob: Blob, dt: number): void => {
  const previousY = blob.y
  blob.vy += GRAVITY * dt
  blob.vx *= 0.995
  blob.y += blob.vy * dt
  blob.x += blob.vx * dt
  if (blob.x < blob.radius || blob.x > world.width - blob.radius) {
    const left = blob.x < blob.radius
    if (Math.abs(blob.vx) > WALL_SPLAT_SPEED) {
      splat(world, blob, left ? 0 : world.width, blob.y - blob.radius, left ? 0 : Math.PI, Math.abs(blob.vx))
    }
    blob.x = clamp(blob.x, blob.radius, world.width - blob.radius)
    blob.vx *= -0.5
  }
  if (blob.y - blob.radius * 2 < 0 && blob.vy < 0) {
    if (-blob.vy > WALL_SPLAT_SPEED) {
      splat(world, blob, blob.x, 0, Math.PI / 2, -blob.vy)
    }
    blob.y = blob.radius * 2
    blob.vy *= -0.4
  }
  land(world, blob, previousY)
  const lowest = world.perches.filter((perch) => blob.x >= perch.x1 && blob.x <= perch.x2).sort((a, b) => b.y - a.y)[0]
  if (!blob.perch && lowest && blob.y > lowest.y) {
    blob.y = lowest.y
    blob.vy = 0
    blob.perch = lowest.element
  }
}

const move = (world: World, blob: Blob, dt: number): void => {
  const perch = blob.perch ? perchOf(world, blob) : undefined
  if (blob.perch && (!perch || blob.x < perch.x1 || blob.x > perch.x2)) {
    blob.perch = null
  }
  if (perch && blob.perch) {
    blob.y = perch.y
    if (blob.dizzy > 0 && Math.random() < dt * 2) {
      blob.vx = randomBetween(-90, 90)
      jump(world, blob, 160)
    }
    if (blob.mood === BlobMood.Working || (blob.leaving && blob.parent)) {
      walk(world, blob, dt, perch)
    }
  }
  if (!blob.perch) {
    fall(world, blob, dt)
  }
}

const growOrLeave = (world: World, blob: Blob, dt: number): boolean => {
  if (!blob.leaving) {
    blob.grow = Math.min(1, blob.grow + dt * 2.5)
    return true
  }
  const near = blob.parent && !blob.stored ? Math.abs(blob.x - blob.parent.x) < blob.parent.radius : true
  blob.grow -= dt * (near ? 4 : 0.6)
  if (blob.grow > 0) {
    return true
  }
  if (blob.parent) {
    impulse(blob.parent, 8)
  }
  removeBlob(world, blob)
  return false
}

const look = (world: World, blob: Blob): void => {
  let lookX = Math.sign(blob.vx) * 0.8
  let lookY = 0
  if (blob.mood === BlobMood.Waiting) {
    lookX = 0
    lookY = -0.4
  }
  if (blob.mood === BlobMood.Idle && blob.perch) {
    const dx = world.pointer.x - blob.x
    const dy = world.pointer.y - (blob.y - blob.radius)
    const distance = Math.max(1, Math.hypot(dx, dy))
    lookX = distance < LOOK_RANGE ? dx / distance : Math.sin(blob.clock * 0.6) * 0.7
    lookY = distance < LOOK_RANGE ? dy / distance : Math.sin(blob.clock * 0.4) * 0.3
  }
  if (blob === world.dragged) {
    lookX = 0
    lookY = 0.5
  }
  blob.lookX = lerp(blob.lookX, lookX, 0.12)
  blob.lookY = lerp(blob.lookY, lookY, 0.12)
}

const animate = (world: World, blob: Blob, dt: number): void => {
  blob.squashVelocity += (-SPRING_STIFFNESS * blob.squash - SPRING_DAMPING * blob.squashVelocity) * dt
  blob.squash += blob.squashVelocity * dt
  if (blob !== world.dragged && blob.vy < -50) {
    blob.squash = lerp(blob.squash, -0.12, 0.2)
  }
  blob.nextBlink -= dt
  if (blob.nextBlink <= 0) {
    blob.blink = 0
    blob.nextBlink = randomBetween(2, 5)
  }
  blob.blink = Math.min(1, blob.blink + dt * 7)
  look(world, blob)
  blob.poke = Math.max(0, blob.poke - dt)
  blob.shake = Math.max(0, blob.shake - dt * 0.7)
  blob.errorMix = lerp(blob.errorMix, blob.mood === BlobMood.Error ? 1 : 0, 0.08)
  if (blob.mood === BlobMood.Idle && blob.perch && blob.idleTime > SLEEP_AFTER_S && Math.random() < dt * 0.8) {
    world.particles.push({ kind: ParticleKind.Snore, x: blob.x + blob.radius * 0.6, y: blob.y - blob.radius * 1.8, vx: 18, vy: -30, life: 1, hue: 0, size: blob.radius * 0.35 })
  }
}

export const updateBlob = (world: World, blob: Blob, dt: number): void => {
  blob.moodTime += dt
  blob.clock += dt
  if (blob.mood === BlobMood.Idle) {
    blob.idleTime += dt
  }
  if (blob.mood === BlobMood.Done && blob.moodTime > DONE_CELEBRATION_S) {
    setMood(world, blob, BlobMood.Idle)
  }
  if (blob.exploded > 0) {
    blob.exploded = Math.max(0, blob.exploded - dt)
    if (blob.exploded === 0) {
      blob.grow = 0
      blob.perch = null
    }
    return
  }
  blob.dizzy = Math.max(0, blob.dizzy - dt)
  blob.radius = lerp(blob.radius, targetRadius(world, blob), Math.min(1, dt * 2))
  if (!growOrLeave(world, blob, dt) || blob.stored) {
    return
  }
  if (blob === world.dragged) {
    blob.x = world.pointer.x
    blob.y = Math.min(world.pointer.y + blob.radius, world.height)
    blob.squash = lerp(blob.squash, -0.14 + 0.04 * Math.sin(blob.clock * 14), 0.3)
  } else {
    move(world, blob, dt)
  }
  animate(world, blob, dt)
}

export const updateParticles = (world: World, dt: number): void => {
  world.particles = world.particles.filter((particle) => {
    if (particle.kind === ParticleKind.Stain) {
      particle.life -= dt / (particle.lifetime ?? 1)
      return particle.life > 0
    }
    particle.life -= dt * (particle.kind === ParticleKind.Snore ? 0.5 : particle.kind === ParticleKind.Drop ? 0.7 : 1)
    if (particle.kind === ParticleKind.Spark || particle.kind === ParticleKind.Drop) {
      particle.vy += GRAVITY * 0.5 * dt
    }
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    return particle.life > 0 && particle.y < world.height + 20
  })
}
