import { BlobMood, ParticleKind, type Blob, type World } from './blobModel'
import { colorOf, drawFigure } from './blobFigure'
import { formatTokens } from './companionSocial'
import { animationPose, drawAnimationBehind, drawAnimationFront } from './cosmetics/animationEffects'
import type { FigurePose } from './cosmetics/cosmeticState'
import { drawFocusBehind, drawFocusFront, focusPose, focusScale, isFocused, outfitOf } from './wardrobeFocus'
import { drawShinyParticle } from './shinyEffects'

const INK = '#1a1530'

const labelOf = (blob: Blob, hovered: boolean, waiting: boolean): string => {
  if (!hovered) {
    return waiting ? '?' : ''
  }
  const activity = waiting ? '?' : blob.mood === BlobMood.Working ? blob.tool : ''
  return [blob.shiny ? `✦ ${blob.name}` : blob.name, activity, formatTokens(blob.context)].filter(Boolean).join(' · ')
}

const easeOutBack = (progress: number): number => 1 + 2.7 * (progress - 1) ** 3 + 1.7 * (progress - 1) ** 2

const RETICLE_COLOR = '#ff2a3a'

const HEART_POINTS: [number, number][] = [[0, 0.95], [-0.95, 0.05], [-0.95, -0.5], [-0.5, -0.9], [0, -0.5], [0.5, -0.9], [0.95, -0.5], [0.95, 0.05]]

const drawHeart = (context: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  const points = HEART_POINTS.map(([pointX, pointY]): [number, number] => [x + pointX * size, y + pointY * size])
  const middle = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = middle(points[points.length - 1], points[0])
  context.beginPath()
  context.moveTo(start[0], start[1])
  points.forEach((point, index) => {
    const next = middle(point, points[(index + 1) % points.length])
    context.quadraticCurveTo(point[0], point[1], next[0], next[1])
  })
  context.closePath()
  context.fill()
  context.strokeStyle = INK
  context.lineWidth = 1.5
  context.stroke()
}

const BUBBLE_HEIGHT = 22
const BUBBLE_MARGIN = 4
const BUBBLE_BELOW_GAP = 6

const drawBubble = (context: CanvasRenderingContext2D, world: World, text: string, x: number, above: number, below: number, pulse: number): void => {
  context.font = '600 12px system-ui, sans-serif'
  const width = context.measureText(text).width + 16
  const y = above - BUBBLE_HEIGHT >= BUBBLE_MARGIN ? above : below + BUBBLE_HEIGHT + BUBBLE_BELOW_GAP
  const half = width / 2 + BUBBLE_MARGIN
  context.save()
  context.translate(Math.min(Math.max(x, half), Math.max(half, world.width - half)), y)
  context.scale(1 + pulse, 1 + pulse)
  context.fillStyle = '#fff'
  context.strokeStyle = INK
  context.lineWidth = 2
  context.beginPath()
  context.roundRect(-width / 2, -22, width, 20, 10)
  context.fill()
  context.stroke()
  context.fillStyle = INK
  context.textAlign = 'center'
  context.fillText(text, 0, -8)
  context.restore()
}

const drawHealthBar = (context: CanvasRenderingContext2D, blob: Blob, radius: number, centerX: number, top: number): void => {
  const width = Math.max(28, radius * 1.6)
  const x = centerX - width / 2
  context.fillStyle = INK
  context.beginPath()
  context.roundRect(x - 1.5, top - 4.5, width + 3, 8, 4)
  context.fill()
  context.fillStyle = `hsl(${Math.round(120 * blob.health)}, 80%, 50%)`
  context.beginPath()
  context.roundRect(x, top - 3, width * blob.health, 5, 2.5)
  context.fill()
}

export const drawBlob = (context: CanvasRenderingContext2D, world: World, blob: Blob): void => {
  const radius = blob.radius * (blob.leaving ? Math.max(blob.grow, 0) : easeOutBack(blob.grow)) * focusScale(world, blob)
  if (radius <= 0.5 || blob.exploded > 0) {
    return
  }
  const outfit = outfitOf(world, blob)
  const pose = focusPose(world, blob, animationPose(blob, outfit, radius), radius)
  const figure = (target: CanvasRenderingContext2D, figurePose: FigurePose): void => drawFigure(target, world, blob, radius, outfit, figurePose)
  drawFocusBehind(context, world, blob, radius)
  drawAnimationBehind(context, blob, outfit, pose, radius, figure)
  context.save()
  context.translate(blob.x + blob.shake * Math.sin(blob.clock * 60) * 6 + pose.dx, blob.y + pose.dy)
  figure(context, pose)
  context.restore()
  drawAnimationFront(context, blob, outfit, pose, radius)
  drawFocusFront(context, world, blob, radius)
  if (isFocused(world, blob)) {
    return
  }
  if (blob === world.dragged || blob.leaving || blob.grow < 1) {
    return
  }
  const waiting = blob.mood === BlobMood.Waiting
  const hovered = world.hovered === blob
  const x = blob.x + pose.dx
  const ground = blob.y + pose.dy
  const top = ground - radius * 2 * (1 - blob.squash) * pose.sy - 8
  const barShown = world.gore && (blob.health < 1 || hovered)
  if (barShown) {
    drawHealthBar(context, blob, radius, x, top)
  }
  const label = labelOf(blob, hovered, waiting)
  if (label) {
    drawBubble(context, world, label, x, barShown ? top - 10 : top, ground, waiting ? 0.08 * Math.sin(blob.moodTime * 6) : 0)
  }
}

export const drawParticles = (context: CanvasRenderingContext2D, world: World): void => {
  let style = ''
  const paint = (next: string): void => {
    if (next !== style) {
      style = next
      context.fillStyle = next
    }
  }
  world.particles.forEach((particle) => {
    if (particle.kind === ParticleKind.Stain || particle.kind === ParticleKind.Hole) {
      return
    }
    context.globalAlpha = Math.max(0, particle.life)
    if (particle.kind === ParticleKind.Drop) {
      paint(`hsl(${particle.hue}, 85%, 38%)`)
      context.beginPath()
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      context.fill()
    } else if (particle.kind === ParticleKind.Spark) {
      paint(`hsl(${particle.hue}, 90%, 65%)`)
      context.beginPath()
      context.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2)
      context.fill()
    } else if (particle.kind === ParticleKind.Heart) {
      paint(`hsl(${particle.hue}, 90%, 70%)`)
      drawHeart(context, particle.x, particle.y, particle.size * (0.7 + 0.3 * particle.life))
    } else if (particle.kind === ParticleKind.Twinkle || particle.kind === ParticleKind.Nova) {
      drawShinyParticle(context, particle)
      style = ''
    } else {
      paint('#c9cfe0')
      context.font = `700 ${particle.size}px system-ui, sans-serif`
      context.fillText('z', particle.x, particle.y)
    }
  })
  context.globalAlpha = 1
}

export const drawStains = (context: CanvasRenderingContext2D, world: World): void => {
  world.particles.forEach((particle) => {
    if (particle.kind !== ParticleKind.Stain && particle.kind !== ParticleKind.Hole) {
      return
    }
    if (particle.kind === ParticleKind.Hole) {
      context.globalAlpha = Math.min(1, particle.life * 1.5)
      context.fillStyle = INK
      context.beginPath()
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      context.fill()
      return
    }
    context.globalAlpha = Math.min(1, particle.life * 1.5) * 0.85
    context.fillStyle = `hsl(${particle.hue}, 80%, 30%)`
    context.beginPath()
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    ;(particle.spots ?? []).forEach(([dx, dy, size]) => {
      context.moveTo(particle.x + dx + size, particle.y + dy)
      context.arc(particle.x + dx, particle.y + dy, size, 0, Math.PI * 2)
    })
    context.fill()
  })
  context.globalAlpha = 1
}

export const drawTombs = (context: CanvasRenderingContext2D, world: World): void => {
  world.blobs.forEach((blob) => {
    if (!blob.tomb) {
      return
    }
    const width = Math.max(16, blob.radius * 0.9)
    const height = width * 1.3
    const { x, y } = blob.tomb
    context.globalAlpha = Math.max(0, Math.min(1, blob.tomb.alpha))
    context.fillStyle = '#8d93a0'
    context.strokeStyle = INK
    context.lineWidth = 2
    context.beginPath()
    context.roundRect(x - width / 2, y - height, width, height, [width / 2, width / 2, 2, 2])
    context.fill()
    context.stroke()
    context.beginPath()
    context.moveTo(x, y - height * 0.78)
    context.lineTo(x, y - height * 0.3)
    context.moveTo(x - width * 0.22, y - height * 0.62)
    context.lineTo(x + width * 0.22, y - height * 0.62)
    context.stroke()
  })
  context.globalAlpha = 1
}

export const drawReticle = (context: CanvasRenderingContext2D, world: World): void => {
  if (!world.sniper) {
    return
  }
  const { x, y } = world.pointer
  const radius = 14 + world.recoil * 8
  if (world.flash > 0) {
    context.globalAlpha = world.flash
    context.fillStyle = '#ffe58a'
    context.beginPath()
    for (let index = 0; index < 8; index++) {
      const angle = (index / 8) * Math.PI * 2
      const reach = (index % 2 ? 10 : 26) * (0.6 + world.flash * 0.4)
      context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach)
    }
    context.closePath()
    context.fill()
    context.globalAlpha = 1
  }
  context.strokeStyle = RETICLE_COLOR
  context.lineWidth = 2
  context.beginPath()
  context.arc(x, y - world.recoil * 6, radius, 0, Math.PI * 2)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    context.moveTo(x + dx * (radius - 6), y - world.recoil * 6 + dy * (radius - 6))
    context.lineTo(x + dx * (radius + 6), y - world.recoil * 6 + dy * (radius + 6))
  }
  context.stroke()
  context.fillStyle = RETICLE_COLOR
  context.beginPath()
  context.arc(x, y - world.recoil * 6, 1.5, 0, Math.PI * 2)
  context.fill()
}

export const drawBasket = (context: CanvasRenderingContext2D, world: World): void => {
  const { basket } = world
  const radius = basket.radius * basket.scale
  const grown = (basket.scale - 1) / 2.2
  context.fillStyle = basket.color
  context.strokeStyle = basket.color
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(basket.x, basket.y, radius, 0, Math.PI * 2)
  context.globalAlpha = 0.04 + grown * 0.06
  context.fill()
  context.globalAlpha = 0.22 + grown * 0.4
  context.stroke()
  context.globalAlpha = 1
  const stored = world.blobs.filter((blob) => blob.stored && !blob.parent && !blob.leaving)
  const dot = Math.max(1.6, radius * 0.16)
  const ring = stored.length > 1 ? radius * 0.5 : 0
  stored.forEach((blob, index) => {
    const angle = (index / stored.length) * Math.PI * 2 - Math.PI / 2
    context.fillStyle = colorOf(blob)
    context.beginPath()
    context.arc(basket.x + Math.cos(angle) * ring, basket.y + Math.sin(angle) * ring, dot, 0, Math.PI * 2)
    context.fill()
  })
}

export const drawBall = (context: CanvasRenderingContext2D, world: World): void => {
  const { ball } = world
  const radius = ball ? ball.radius * ball.scale : 0
  if (!ball || radius <= 0.5) {
    return
  }
  context.globalAlpha = ball.alpha
  context.fillStyle = '#ffd84a'
  context.strokeStyle = INK
  context.lineWidth = 2
  context.beginPath()
  context.arc(ball.x, ball.y, radius, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.beginPath()
  context.arc(ball.x, ball.y, radius * 0.6, Math.PI * 1.15, Math.PI * 1.6)
  context.strokeStyle = '#fff'
  context.stroke()
  context.globalAlpha = 1
}
