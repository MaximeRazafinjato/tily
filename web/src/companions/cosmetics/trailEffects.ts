import type { CompanionOutfit } from '../../bridge/appearanceMessages'
import { pick, randomBetween, type Blob, type World } from '../blobModel'
import { isFocused } from '../wardrobeFocus'
import { animationPose, updateAnimation } from './animationEffects'
import { CompanionAnimation, CompanionTrail } from './cosmeticCatalog'
import { clayLine, drawClayShape, HEART, INK, star, TAU } from './clayShapes'
import type { TrailParticle } from './cosmeticState'

const TRACE_S = 2.6
const MAX_TRAILS = 600
const MOVING_SPEED = 40
const IDLE_SHARE = 0.25
const RAINBOW = ['#f07a70', '#ffb05a', '#ffd84a', '#7ad97a', '#5ab4ff', '#a98fc9']
const RIBBON_S: Partial<Record<CompanionTrail, number>> = { [CompanionTrail.Rainbow]: 1.1, [CompanionTrail.Slime]: 2.6 }

interface TrailKind {
  rate: number
  spawn: (blob: Blob, back: number, center: number, direction: number) => Partial<TrailParticle>
  draw: (context: CanvasRenderingContext2D, particle: TrailParticle, life: number, radius: number) => void
}

const fade = (life: number, speed = 1.6): number => Math.min(1, life * speed)

const TRAILS: Partial<Record<CompanionTrail, TrailKind>> = {
  [CompanionTrail.Stars]: {
    rate: 9,
    spawn: (blob, back, center, direction) => ({ x: back, y: center + randomBetween(-0.6, 0.6) * blob.radius, vx: -direction * randomBetween(5, 25), vy: randomBetween(-30, 10), gravity: 30, life: 1.2, size: blob.radius * randomBetween(0.14, 0.24), spin: randomBetween(-3, 3), color: pick(['#ffe58a', '#fff3a0', '#ffd84a']) }),
    draw: (context, particle, life, radius) => drawClayShape(context, star(0, 0, 1, 0.45, 5), particle.x, particle.y, particle.size * (0.5 + 0.5 * life), particle.rotation, particle.color, fade(life), clayLine(radius) * 0.6),
  },
  [CompanionTrail.Bubbles]: {
    rate: 7,
    spawn: (blob, back, center) => ({ x: back, y: center + randomBetween(-0.3, 0.6) * blob.radius, vy: -randomBetween(25, 50), life: randomBetween(1.2, 1.8), size: blob.radius * randomBetween(0.08, 0.17) }),
    draw: (context, particle, life, radius) => {
      const x = particle.x + Math.sin(particle.life * 5 + particle.seed) * 4
      context.save()
      context.globalAlpha = fade(life, 2)
      context.strokeStyle = '#a8e0ff'
      context.lineWidth = clayLine(radius) * 0.5
      if (life < 0.1) {
        for (let index = 0; index < 5; index++) {
          const angle = (index * TAU) / 5
          context.beginPath()
          context.moveTo(x + Math.cos(angle) * particle.size * 0.8, particle.y + Math.sin(angle) * particle.size * 0.8)
          context.lineTo(x + Math.cos(angle) * particle.size * 1.4, particle.y + Math.sin(angle) * particle.size * 1.4)
          context.stroke()
        }
      } else {
        context.fillStyle = 'rgba(168, 224, 255, 0.22)'
        context.beginPath()
        context.arc(x, particle.y, particle.size, 0, TAU)
        context.fill()
        context.stroke()
        context.strokeStyle = '#ffffff'
        context.beginPath()
        context.arc(x, particle.y, particle.size * 0.6, Math.PI * 1.15, Math.PI * 1.5)
        context.stroke()
      }
      context.restore()
    },
  },
  [CompanionTrail.Hearts]: {
    rate: 5,
    spawn: (blob, back, center, direction) => ({ x: back, y: center + randomBetween(-0.4, 0.3) * blob.radius, vx: -direction * randomBetween(0, 10), vy: -randomBetween(25, 40), life: 1.4, size: blob.radius * randomBetween(0.13, 0.2), color: pick(['#ff7a9a', '#ff5a8a']) }),
    draw: (context, particle, life, radius) => {
      const sway = Math.sin(particle.life * 4 + particle.seed)
      drawClayShape(context, HEART, particle.x + sway * 5, particle.y, particle.size, sway * 0.2, particle.color, fade(life, 1.5), clayLine(radius) * 0.6)
    },
  },
  [CompanionTrail.Slime]: {
    rate: 2.5,
    spawn: (blob, _back, _center, direction) => ({ x: blob.x - direction * blob.radius * randomBetween(0.2, 0.6), y: blob.y + randomBetween(1, 4), life: 2.4, size: blob.radius * randomBetween(0.07, 0.12), color: `hsl(${blob.hue}, 85%, 60%)` }),
    draw: (context, particle, life) => {
      context.save()
      context.globalAlpha = life * 0.6
      context.fillStyle = particle.color
      context.beginPath()
      context.ellipse(particle.x, particle.y, particle.size * 1.4, particle.size * 0.6, 0, 0, TAU)
      context.fill()
      context.restore()
    },
  },
  [CompanionTrail.Pixels]: {
    rate: 22,
    spawn: (blob, back, center, direction) => ({ x: back + randomBetween(-0.2, 0.2) * blob.radius, y: center + randomBetween(-0.5, 0.5) * blob.radius, vx: -direction * randomBetween(10, 30), vy: randomBetween(-20, 5), gravity: 50, life: randomBetween(0.6, 1.1), size: blob.radius * randomBetween(0.12, 0.2), color: `hsl(${blob.hue + randomBetween(-50, 50)}, 85%, 65%)` }),
    draw: (context, particle, life) => {
      const grid = 2
      const size = Math.max(grid, Math.round((particle.size * Math.min(1, life * 1.4)) / grid) * grid)
      context.save()
      context.globalAlpha = life > 0.25 ? 1 : life / 0.25
      context.fillStyle = particle.color
      context.fillRect(Math.round(particle.x / grid) * grid - size / 2, Math.round(particle.y / grid) * grid - size / 2, size, size)
      context.restore()
    },
  },
}

const outfitFor = (world: World, blob: Blob): CompanionOutfit => (world.focus?.key === blob.key && world.focus.preview ? world.focus.preview : blob.outfit)

const traced = (outfit: CompanionOutfit): boolean => outfit.trail !== undefined || outfit.animation === CompanionAnimation.Ninja

const updateTrace = (world: World, blob: Blob, outfit: CompanionOutfit): void => {
  if (!traced(outfit)) {
    blob.trace.length = 0
    return
  }
  blob.trace.unshift({ x: blob.x, y: blob.y - blob.radius, ground: blob.y, t: world.clock, pose: animationPose(blob, outfit, blob.radius) })
  while (blob.trace.length > 2 && world.clock - (blob.trace.at(-1)?.t ?? world.clock) > TRACE_S) {
    blob.trace.pop()
  }
}

const spawnTrail = (world: World, blob: Blob, trail: TrailKind, kind: CompanionTrail, dt: number): void => {
  const moving = Math.hypot(blob.vx, blob.vy) > MOVING_SPEED
  blob.effect.spawn += trail.rate * dt * (moving ? 1 : IDLE_SHARE)
  const direction = Math.sign(blob.vx) || blob.effect.side
  while (blob.effect.spawn >= 1 && world.trails.length < MAX_TRAILS) {
    blob.effect.spawn -= 1
    const center = blob.y - blob.radius
    const particle = trail.spawn(blob, blob.x - direction * blob.radius * 0.55, center, direction)
    const life = particle.life ?? 1
    world.trails.push({ kind, x: blob.x, y: center, vx: 0, vy: 0, gravity: 0, size: 4, rotation: randomBetween(0, TAU), spin: 0, seed: randomBetween(0, 9), color: '#ffffff', floor: null, ...particle, life, max: life })
  }
  blob.effect.spawn = Math.min(blob.effect.spawn, 1)
}

export const updateCosmetics = (world: World, dt: number): void => {
  world.blobs.forEach((blob) => {
    const outfit = outfitFor(world, blob)
    if (!blob.stored && blob.exploded === 0) {
      updateAnimation(world, blob, outfit.animation, isFocused(world, blob.parent ?? blob))
    }
    updateTrace(world, blob, outfit)
    const trail = TRAILS[outfit.trail as CompanionTrail]
    if (trail && !blob.stored && blob.exploded === 0 && blob.grow >= 1) {
      spawnTrail(world, blob, trail, outfit.trail as CompanionTrail, dt)
    }
  })
  world.trails = world.trails.filter((particle) => {
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vy += particle.gravity * dt
    particle.rotation += particle.spin * dt
    particle.life -= dt
    return particle.life > 0
  })
}

const drawRibbon = (context: CanvasRenderingContext2D, world: World, blob: Blob, kind: CompanionTrail): void => {
  const lifetime = RIBBON_S[kind] ?? 1
  const trace = blob.trace
  context.save()
  context.lineCap = 'butt'
  for (let index = 0; index < trace.length - 1; index++) {
    const from = trace[index]
    const to = trace[index + 1]
    const age = world.clock - from.t
    if (age > lifetime) {
      break
    }
    const strength = 1 - age / lifetime
    if (kind === CompanionTrail.Rainbow) {
      const width = blob.radius * 0.13
      RAINBOW.forEach((color, band) => {
        const offset = (band - (RAINBOW.length - 1) / 2) * width
        context.globalAlpha = strength * 0.9
        context.strokeStyle = color
        context.lineWidth = width + 0.6
        context.beginPath()
        context.moveTo(from.x, from.y + offset)
        context.lineTo(to.x, to.y + offset)
        context.stroke()
      })
    } else {
      context.globalAlpha = 1
      context.strokeStyle = `hsla(${blob.hue}, 85%, 60%, ${strength * 0.6})`
      context.lineWidth = blob.radius * 0.2
      context.beginPath()
      context.moveTo(from.x, from.ground + 2)
      context.lineTo(to.x, to.ground + 2)
      context.stroke()
      context.strokeStyle = `rgba(255, 255, 255, ${strength * 0.45})`
      context.lineWidth = 1.2
      context.beginPath()
      context.moveTo(from.x, from.ground)
      context.lineTo(to.x, to.ground)
      context.stroke()
    }
  }
  context.restore()
}

export const drawTrails = (context: CanvasRenderingContext2D, world: World): void => {
  world.blobs.forEach((blob) => {
    const kind = outfitFor(world, blob).trail as CompanionTrail
    if (!blob.stored && RIBBON_S[kind] !== undefined) {
      drawRibbon(context, world, blob, kind)
    }
  })
  world.trails.forEach((particle) => {
    const radius = particle.size * 5
    TRAILS[particle.kind]?.draw(context, particle, Math.max(0, particle.life / particle.max), radius)
  })
  context.globalAlpha = 1
  context.strokeStyle = INK
}

export const cosmeticsActive = (world: World): boolean => world.trails.length > 0 || world.focus !== null || world.blobs.some((blob) => !blob.stored && Object.values(blob.outfit).some(Boolean))
