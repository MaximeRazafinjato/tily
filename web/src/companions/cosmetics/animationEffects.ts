import type { CompanionOutfit } from '../../bridge/appearanceMessages'
import { BlobMood, clamp, GRAVITY, jump, pick, randomBetween, type Blob, type World } from '../blobModel'
import { CompanionAnimation } from './cosmeticCatalog'
import { drawClayShape, easeInOutCubic, hashUnit, INK, ring, smoothstep, star, TAU } from './clayShapes'
import type { FigurePose } from './cosmeticState'
import { hueOf } from '../shinyEffects'
import { drawTinted } from './offscreenFigure'

const STOP_MOTION_FPS = 7
const TELEPORT_S = 0.7
const TELEPORT_REACH = 8
const TELEPORT_MIN = 3
const TELEPORT_ATTEMPTS = 8
const SPIN_S = 0.75
const SPRING_PERIOD_S = 1
const NINJA_SPEED = 220
const NINJA_DASH = 380
const NINJA_HOP = 150
const WALK_HOP_MAX = 300
const NINJA_LAGS = [3, 6, 9, 12]
const NINJA_TINT = '#3a3360'

type Figure = (context: CanvasRenderingContext2D, pose: FigurePose) => void

const easeOutBack = (progress: number): number => 1 + 2.7 * (progress - 1) ** 3 + 1.7 * (progress - 1) ** 2

const directionOf = (blob: Blob): number => Math.sign(blob.vx) || blob.effect.side

export const basePose = (blob: Blob): FigurePose => ({ dx: 0, dy: 0, sx: 1, sy: 1, rotation: 0, time: blob.clock, hue: hueOf(blob) })

const teleportPhase = (blob: Blob): number | null => {
  const phase = (blob.clock - blob.effect.startedAt) / TELEPORT_S
  return phase >= 0 && phase < 1 ? phase : null
}

export const springOf = (blob: Blob, radius: number): { length: number; height: number; squash: number } => {
  const phase = (blob.clock % SPRING_PERIOD_S) / SPRING_PERIOD_S
  if (phase < 0.22) {
    const press = Math.sin((phase / 0.22) * Math.PI)
    return { length: radius * (0.6 - 0.38 * press), height: 0, squash: 0.14 * press }
  }
  const flight = Math.sin(((phase - 0.22) / 0.78) * Math.PI)
  return { length: radius * (0.6 + 0.08 * flight), height: flight * radius * 1.05, squash: 0 }
}

const dash = (world: World, blob: Blob): void => {
  const effect = blob.effect
  if (blob.vy === 0) {
    effect.dashed = false
  }
  const hopping = !blob.perch && blob.vy < 0 && blob.vy > -WALK_HOP_MAX && Math.abs(blob.vx) > 0 && Math.abs(blob.vx) < NINJA_SPEED
  if (effect.dashed || !hopping || blob.mood !== BlobMood.Working || blob === world.dragged) {
    return
  }
  const airTime = (2 * NINJA_HOP) / GRAVITY
  blob.vx = Math.sign(blob.targetX - blob.x || blob.vx) * Math.min(NINJA_DASH, Math.abs(blob.targetX - blob.x) / airTime)
  blob.vy = -NINJA_HOP
  effect.dashed = true
}

const teleportSpot =(world: World, blob: Blob): { x: number; y: number; perch: Element | null } | null => {
  const reach = blob.radius * TELEPORT_REACH
  const spots = world.perches.flatMap((perch) => {
    const min = Math.max(perch.x1 + blob.radius, blob.x - reach)
    const max = Math.min(perch.x2 - blob.radius, blob.x + reach)
    return max > min ? [{ perch, min, max }] : []
  })
  for (let attempt = 0; attempt < TELEPORT_ATTEMPTS && spots.length; attempt++) {
    const { perch, min, max } = pick(spots)
    const x = randomBetween(min, max)
    if (Math.hypot(x - blob.x, perch.y - blob.y) >= blob.radius * TELEPORT_MIN) {
      return { x, y: perch.y, perch: perch.element }
    }
  }
  return null
}

const STARTERS:Partial<Record<CompanionAnimation, (world: World, blob: Blob, frozen: boolean) => void>> = {
  [CompanionAnimation.Teleport]: (world, blob, frozen) => {
    if (teleportPhase(blob) !== null) {
      return
    }
    blob.effect.nextAt = blob.clock + randomBetween(5, 9)
    const spot = frozen ? { x: blob.x, y: blob.y, perch: blob.perch } : teleportSpot(world, blob)
    if (spot) {
      Object.assign(blob.effect, { startedAt: blob.clock, fromX: blob.x, fromY: blob.y, toX: spot.x, toY: spot.y, toPerch: spot.perch, moved: false })
    }
  },
  [CompanionAnimation.Spin]: (world, blob, frozen) => {
    if (!frozen) {
      jump(world, blob, 560)
    }
    Object.assign(blob.effect, { startedAt: blob.clock, nextAt: blob.clock + randomBetween(3.5, 6) })
  },
}

export const updateAnimation = (world: World, blob: Blob, animation: string | undefined, frozen: boolean): void => {
  const effect = blob.effect
  effect.side = Math.sign(blob.vx) || effect.side
  if (animation === CompanionAnimation.StopMotion) {
    const frame = Math.floor(blob.clock * STOP_MOTION_FPS)
    if (frame !== effect.frame) {
      Object.assign(effect, { frame, heldX: blob.x, heldY: blob.y, heldTime: blob.clock })
    }
  }
  const phase = teleportPhase(blob)
  if (animation === CompanionAnimation.Teleport && phase !== null) {
    blob.vx = 0
    if (phase >= 0.5 && !effect.moved && !frozen) {
      Object.assign(blob, { x: effect.toX, y: effect.toY, targetX: effect.toX, vy: 0, perch: effect.toPerch })
      effect.moved = true
    }
  }
  if (animation === CompanionAnimation.Ninja) {
    dash(world, blob)
  }
  const start = STARTERS[animation as CompanionAnimation]
  if (start && blob.perch && blob !== world.dragged && blob.clock >= effect.nextAt) {
    start(world, blob, frozen)
  }
}

export const animationPose = (blob: Blob, outfit: CompanionOutfit, radius: number): FigurePose => {
  const pose = basePose(blob)
  const effect = blob.effect
  switch (outfit.animation) {
    case CompanionAnimation.StopMotion:
      return { ...pose, dx: effect.heldX - blob.x, dy: effect.heldY - blob.y, time: effect.heldTime, rotation: (hashUnit(effect.frame, 1, 7) - 0.5) * 0.1 }
    case CompanionAnimation.Ninja:
      return blob.vy === 0 ? pose : { ...pose, rotation: Math.sign(blob.vx) * clamp(Math.abs(blob.vx) / 700, 0, 0.35) }
    case CompanionAnimation.Teleport: {
      const phase = teleportPhase(blob)
      if (phase === null) {
        return pose
      }
      const squeeze = phase < 0.5 ? smoothstep(phase / 0.5) : 1 - easeOutBack((phase - 0.5) / 0.5)
      return { ...pose, sx: 1 - 0.94 * squeeze, sy: 1 + 0.9 * squeeze }
    }
    case CompanionAnimation.Spin: {
      const progress = (blob.clock - effect.startedAt) / SPIN_S
      return progress >= 0 && progress < 1 ? { ...pose, rotation: easeInOutCubic(progress) * TAU * 2 * directionOf(blob) } : pose
    }
    case CompanionAnimation.Levitation:
      return { ...pose, dy: -radius * (0.45 + 0.12 * Math.sin(blob.clock * 1.7)), rotation: Math.sin(blob.clock * 0.9) * 0.04 }
    case CompanionAnimation.Disco: {
      const beat = blob.clock * 2.2
      const hop = Math.abs(Math.sin(beat * Math.PI))
      const land = Math.max(0, 1 - hop * 3)
      return { ...pose, dy: -hop * radius * 0.22, sx: 1 + 0.1 * land, sy: 1 - 0.1 * land, rotation: Math.sin((beat * Math.PI) / 2) * 0.18, hue: (blob.clock * 110) % 360 }
    }
    case CompanionAnimation.Spring: {
      const spring = springOf(blob, radius)
      return { ...pose, dy: -(spring.length + spring.height), sx: 1 + spring.squash, sy: 1 - spring.squash, rotation: spring.height > 0 ? directionOf(blob) * 0.08 : 0 }
    }
    default:
      return pose
  }
}

const drawOrbs = (context: CanvasRenderingContext2D, blob: Blob, radius: number, centerY: number, front: boolean): void => {
  for (let index = 0; index < 3; index++) {
    const angle = blob.clock * 1.4 + (index * TAU) / 3
    if (Math.sin(angle) > 0 === front) {
      drawClayShape(context, ring(0, 0, 1, 1, 10), blob.x + Math.cos(angle) * radius * 1.45, centerY + Math.sin(angle) * radius * 0.35, radius * 0.09, 0, `hsl(${blob.hue + 30}, 90%, 75%)`, 1, 1.2)
    }
  }
}

const BEHIND: Partial<Record<CompanionAnimation, (context: CanvasRenderingContext2D, blob: Blob, pose: FigurePose, radius: number, figure: Figure) => void>> = {
  [CompanionAnimation.Ninja]: (context, blob, _pose, radius, figure) => {
    if (Math.hypot(blob.vx, blob.vy) < NINJA_SPEED) {
      return
    }
    NINJA_LAGS.forEach((lag, index) => {
      const past = blob.trace[lag]
      if (!past) {
        return
      }
      context.save()
      context.globalAlpha = 0.34 - index * 0.07
      context.translate(past.x + past.pose.dx, past.ground + past.pose.dy)
      drawTinted(context, radius, NINJA_TINT, (target) => figure(target, past.pose))
      context.restore()
    })
  },
  [CompanionAnimation.Teleport]: (context, blob, _pose, radius) => {
    const phase = teleportPhase(blob)
    if (phase === null) {
      return
    }
    const glow = Math.sin(phase * Math.PI)
    ;[
      [blob.effect.fromX, blob.effect.fromY],
      [blob.effect.toX, blob.effect.toY],
    ].forEach(([x, y]) => {
      context.save()
      context.globalAlpha = glow * 0.5
      context.fillStyle = `hsl(${blob.hue}, 100%, 80%)`
      context.beginPath()
      context.roundRect(x - radius * 0.2, y - radius * 3.4, radius * 0.4, radius * 3.4, radius * 0.2)
      context.fill()
      context.restore()
      for (let index = 0; index < 4; index++) {
        drawClayShape(context, star(0, 0, 1, 0.4), x + Math.sin(index * 2.3 + blob.clock * 6) * radius * 0.6, y - radius * (0.3 + ((blob.clock * 1.2 + index * 0.25) % 1) * 2.8), radius * 0.16 * glow, 0, '#fff3a0', glow, 1)
      }
    })
  },
  [CompanionAnimation.Levitation]: (context, blob, pose, radius) => {
    const centerY = blob.y + pose.dy - radius
    context.save()
    context.fillStyle = 'rgba(0, 0, 0, 0.3)'
    context.beginPath()
    context.ellipse(blob.x, blob.y + 2, radius * 0.9, radius * 0.12, 0, 0, TAU)
    context.fill()
    for (let index = 0; index < 2; index++) {
      const phase = (blob.clock * 0.55 + index * 0.5) % 1
      context.globalAlpha = (1 - phase) * 0.55
      context.strokeStyle = `hsl(${blob.hue}, 90%, 72%)`
      context.lineWidth = 3 * (1 - phase) + 1
      context.beginPath()
      context.arc(blob.x, centerY, radius * (1.05 + phase * 0.9), 0, TAU)
      context.stroke()
    }
    context.restore()
    drawOrbs(context, blob, radius, centerY, false)
  },
  [CompanionAnimation.Disco]: (context, blob, _pose, radius) => {
    context.save()
    for (let index = 0; index < 3; index++) {
      const hue = (index * 120 + blob.clock * 60) % 360
      const x = blob.x + Math.sin(blob.clock * 0.9 + index * 1.6) * radius * 1.6
      context.fillStyle = `hsla(${hue}, 90%, 70%, 0.1)`
      context.beginPath()
      context.moveTo(blob.x, blob.y - radius * 4)
      context.lineTo(x - radius * 0.5, blob.y)
      context.lineTo(x + radius * 0.5, blob.y)
      context.closePath()
      context.fill()
      context.fillStyle = `hsla(${hue}, 90%, 70%, 0.55)`
      context.beginPath()
      context.ellipse(x, blob.y + 2, radius * 0.4, 3, 0, 0, TAU)
      context.fill()
    }
    context.restore()
  },
  [CompanionAnimation.Spring]: (context, blob, _pose, radius) => {
    const { length, height } = springOf(blob, radius)
    const bottom = blob.y - height
    const top = bottom - length - radius * 0.1
    const coils = 6
    context.save()
    context.lineJoin = 'round'
    context.lineCap = 'round'
    ;[
      [INK, radius * 0.17],
      ['#c9cdd8', radius * 0.08],
    ].forEach(([color, width]) => {
      context.strokeStyle = String(color)
      context.lineWidth = Number(width)
      context.beginPath()
      context.moveTo(blob.x, bottom)
      for (let index = 1; index < coils; index++) {
        context.lineTo(blob.x + (index % 2 ? 1 : -1) * radius * 0.3, bottom - ((bottom - top) * index) / coils)
      }
      context.lineTo(blob.x, top)
      context.stroke()
    })
    context.restore()
  },
}

export const drawAnimationBehind = (context: CanvasRenderingContext2D, blob: Blob, outfit: CompanionOutfit, pose: FigurePose, radius: number, figure: Figure): void => {
  BEHIND[outfit.animation as CompanionAnimation]?.(context, blob, pose, radius, figure)
}

export const drawAnimationFront = (context: CanvasRenderingContext2D, blob: Blob, outfit: CompanionOutfit, pose: FigurePose, radius: number): void => {
  if (outfit.animation === CompanionAnimation.Levitation) {
    drawOrbs(context, blob, radius, blob.y + pose.dy - radius, true)
  }
}
