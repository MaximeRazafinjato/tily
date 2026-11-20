import { BlobMood, impulse, jump, NIGHT_SLEEP_AFTER_S, ParticleKind, randomBetween, SLEEP_AFTER_S, type Blob, type World } from './blobModel'

const BUMP_COOLDOWN_S = 1.2
const HIGH_FIVE_WINDOW_S = 3
const HIGH_FIVE_DELAY_S = 0.35
const FLEE_DISTANCE = 120
const FLEE_POINTER_SPEED = 1500
const FLEE_COOLDOWN_S = 1.5
const APPROACH_DISTANCE = 170
const APPROACH_AFTER_S = 2
const APPROACH_COOLDOWN_S = 0.6
const YAWN_S = 1.3
const YAWNS_PER_S = 0.04
const EVENING_HOUR = 21
const MORNING_HOUR = 7
const CLAP_HUE = 48

const active = (world: World, blob: Blob): boolean => !blob.stored && !blob.leaving && blob.exploded === 0 && blob !== world.dragged && blob.grow >= 1

const isNight = (): boolean => {
  const hour = new Date().getHours()
  return hour >= EVENING_HOUR || hour < MORNING_HOUR
}

const push = (world: World, blob: Blob, side: number): void => {
  blob.vx = side * randomBetween(120, 200)
  blob.bumpCooldown = BUMP_COOLDOWN_S
  impulse(blob, 8)
  jump(world, blob, 260)
}

const bump = (world: World, blobs: Blob[]): void => {
  for (let first = 0; first < blobs.length; first++) {
    for (let second = first + 1; second < blobs.length; second++) {
      const a = blobs[first]
      const b = blobs[second]
      const overlap = a.radius + b.radius - Math.abs(a.x - b.x)
      if (!a.perch || a.perch !== b.perch || overlap < (a.radius + b.radius) * 0.25 || a.bumpCooldown > 0 || b.bumpCooldown > 0) {
        continue
      }
      const direction = Math.sign(a.x - b.x) || 1
      push(world, a, direction)
      push(world, b, -direction)
    }
  }
}

const highFive = (world: World, blobs: Blob[]): void => {
  const fresh = blobs.filter((blob) => !blob.parent && world.clock - blob.doneAt < 0.25 && !blob.highFiveWith)
  fresh.forEach((blob) => {
    const partner = blobs.find((other) => other !== blob && !other.parent && !other.highFiveWith && world.clock - other.doneAt < HIGH_FIVE_WINDOW_S)
    if (!partner) {
      return
    }
    ;[blob, partner].forEach((member) => {
      const other = member === blob ? partner : blob
      member.highFiveWith = other
      member.highFiveTimer = HIGH_FIVE_DELAY_S
      member.vx = Math.sign(other.x - member.x) * Math.min(500, Math.abs(other.x - member.x) * 1.6)
      jump(world, member, 750)
    })
  })
}

const clap = (world: World, blob: Blob, dt: number): void => {
  if (!blob.highFiveWith) {
    return
  }
  blob.highFiveTimer -= dt
  if (blob.highFiveTimer > 0) {
    return
  }
  const other = blob.highFiveWith
  blob.highFiveWith = null
  blob.poke = 1
  if (other.highFiveWith === blob) {
    other.highFiveWith = null
    other.poke = 1
    const x = (blob.x + other.x) / 2
    const y = Math.min(blob.y - blob.radius * 2, other.y - other.radius * 2)
    for (let index = 0; index < 16; index++) {
      const angle = randomBetween(0, Math.PI * 2)
      const speed = randomBetween(120, 380)
      world.particles.push({ kind: ParticleKind.Spark, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.8, hue: CLAP_HUE, size: randomBetween(2, 4) })
    }
  }
}

const reactToPointer = (world: World, blob: Blob, dt: number): void => {
  if (blob.mood !== BlobMood.Idle || !blob.perch || world.sniper) {
    blob.nearPointer = 0
    return
  }
  const dx = world.pointer.x - blob.x
  const distance = Math.hypot(dx, world.pointer.y - (blob.y - blob.radius))
  if (distance < FLEE_DISTANCE && world.pointerSpeed > FLEE_POINTER_SPEED && blob.fleeCooldown <= 0) {
    blob.vx = -Math.sign(dx || 1) * randomBetween(220, 300)
    blob.fleeCooldown = FLEE_COOLDOWN_S
    blob.idleTime = 0
    jump(world, blob, 420)
    return
  }
  blob.nearPointer = distance < APPROACH_DISTANCE ? blob.nearPointer + dt : 0
  if (blob.nearPointer > 0) {
    blob.idleTime = 0
  }
  if (blob.nearPointer > APPROACH_AFTER_S && Math.abs(dx) > blob.radius && blob.approachCooldown <= 0) {
    blob.vx = Math.sign(dx) * randomBetween(60, 90)
    blob.approachCooldown = APPROACH_COOLDOWN_S
    jump(world, blob, 180)
  }
}

const yawn = (world: World, blob: Blob, dt: number, night: boolean): void => {
  blob.yawn = Math.max(0, blob.yawn - dt)
  if (night && blob.mood === BlobMood.Idle && blob.yawn === 0 && blob.idleTime < world.sleepAfter && Math.random() < dt * YAWNS_PER_S) {
    blob.yawn = YAWN_S
  }
}

export const updateSocial = (world: World, dt: number): void => {
  world.clock += dt
  world.pointerSpeed = Math.max(0, world.pointerSpeed - dt * 6000)
  const night = isNight()
  world.sleepAfter = night ? NIGHT_SLEEP_AFTER_S : SLEEP_AFTER_S
  const blobs = world.blobs.filter((blob) => active(world, blob))
  blobs.forEach((blob) => {
    blob.bumpCooldown = Math.max(0, blob.bumpCooldown - dt)
    blob.fleeCooldown = Math.max(0, blob.fleeCooldown - dt)
    blob.approachCooldown = Math.max(0, blob.approachCooldown - dt)
    clap(world, blob, dt)
    reactToPointer(world, blob, dt)
    yawn(world, blob, dt, night)
  })
  highFive(world, blobs)
  bump(world, blobs.filter((blob) => !blob.highFiveWith))
}

export const formatTokens = (tokens: number | undefined): string => {
  if (tokens === undefined) {
    return ''
  }
  return tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M` : tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : `${tokens}`
}
