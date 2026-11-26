import { HURT_S, SAD_HEALTH } from './goreEffects'
import { BlobMood, lerp, ParticleKind, PETTED, SHAPES, type Blob, type World } from './blobModel'
import { drawProps, faceOffset } from './blobProps'
import { formatTokens } from './companionSocial'

const INK = '#1a1530'
const ERROR_HUE = 8
const OUTLINE_POINTS = 32
const CORNER_ROUNDING = 0.18
const WOBBLE: Record<BlobMood, { energy: number; speed: number }> = {
  [BlobMood.Idle]: { energy: 0.035, speed: 1.6 },
  [BlobMood.Working]: { energy: 0.07, speed: 4.2 },
  [BlobMood.Waiting]: { energy: 0.05, speed: 3 },
  [BlobMood.Done]: { energy: 0.09, speed: 6 },
  [BlobMood.Error]: { energy: 0.06, speed: 9 },
}
const DRAGGED_WOBBLE = { energy: 0.08, speed: 8 }

const labelOf = (blob: Blob, hovered: boolean, waiting: boolean): string => {
  if (!hovered) {
    return waiting ? '?' : ''
  }
  const activity = waiting ? '?' : blob.mood === BlobMood.Working ? blob.tool : ''
  return [blob.name, activity, formatTokens(blob.context)].filter(Boolean).join(' · ')
}

const easeOutBack = (progress: number): number => 1 + 2.7 * (progress - 1) ** 3 + 1.7 * (progress - 1) ** 2

const colorOf = (blob: Blob): string => {
  const errorHue = ERROR_HUE + (blob.hue > 180 ? 360 : 0)
  return `hsl(${lerp(blob.hue, errorHue, blob.errorMix)}, 85%, ${lerp(64, 52, blob.errorMix)}%)`
}

type Point = [number, number]

const middle = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

const outlinePoints = (world: World, blob: Blob, radius: number): Point[] => {
  const { sides, rotation } = SHAPES[blob.shape]
  const { energy, speed } = blob === world.dragged ? DRAGGED_WOBBLE : WOBBLE[blob.mood]
  const time = blob.clock * speed
  const sector = (Math.PI * 2) / sides
  const points: Point[] = []
  for (let index = 0; index < OUTLINE_POINTS; index++) {
    const angle = (index / OUTLINE_POINTS) * Math.PI * 2
    const local = (((angle - rotation) % sector) + sector) % sector - sector / 2
    const polygon = sides ? Math.cos(sector / 2) / Math.cos(local) : 1
    const distance = radius * lerp(polygon, 1, CORNER_ROUNDING) * (1 + energy * Math.sin(time + angle * 3) + energy * 0.6 * Math.sin(time * 1.37 + angle * 5))
    points.push([Math.cos(angle) * distance, Math.sin(angle) * distance])
  }
  return points
}

const lowestOf = (points: Point[]): number =>
  Math.max(...points.map((point, index) => (middle(points[(index + OUTLINE_POINTS - 1) % OUTLINE_POINTS], point)[1] + 2 * point[1] + middle(point, points[(index + 1) % OUTLINE_POINTS])[1]) / 4))

const outline = (context: CanvasRenderingContext2D, points: Point[]): void => {
  const start = middle(points[OUTLINE_POINTS - 1], points[0])
  context.beginPath()
  context.moveTo(start[0], start[1])
  points.forEach((point, index) => {
    const next = middle(point, points[(index + 1) % OUTLINE_POINTS])
    context.quadraticCurveTo(point[0], point[1], next[0], next[1])
  })
  context.closePath()
}

const RETICLE_COLOR = '#ff2a3a'

const painedOf = (blob: Blob): boolean => blob.hurt > HURT_S - 0.5

const sadOf = (world: World, blob: Blob): boolean => world.gore && (blob.hurt > 0 || blob.health < SAD_HEALTH)

const drawEye = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number, x: number, y: number, side: number): void => {
  const surprised = blob === world.dragged
  const size = radius * 0.1
  const sad = !surprised && sadOf(world, blob)
  const happy = !surprised && !sad && (blob.mood === BlobMood.Done || blob.poke > 0 || blob.pet > PETTED)
  const sleeping = !surprised && ((blob.mood === BlobMood.Idle && blob.idleTime > world.sleepAfter) || blob.yawn > 0)
  context.beginPath()
  if (blob.dizzy > 0 && !surprised) {
    for (let step = 0; step <= 24; step++) {
      const angle = step * 0.55 + blob.clock * 8
      const distance = (step / 24) * radius * 0.13
      context.lineTo(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance)
    }
    context.stroke()
  } else if (!surprised && painedOf(blob)) {
    context.moveTo(x + side * size, y - size)
    context.lineTo(x - side * size, y)
    context.lineTo(x + side * size, y + size)
    context.stroke()
  } else if (sad) {
    context.moveTo(x + side * size * 1.1, y - size * 1.2)
    context.lineTo(x - side * size * 1.1, y - size * 2)
    context.stroke()
    context.beginPath()
    context.ellipse(x, y + size * 0.3, radius * 0.07, radius * 0.08, 0, 0, Math.PI * 2)
    context.fill()
    if (side < 0) {
      const fall = (blob.clock % 1.4) / 1.4
      context.fillStyle = '#5ab4ff'
      context.beginPath()
      context.ellipse(x, y + size * (1.6 + fall * 3), size * 0.35, size * 0.5, 0, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = INK
    }
  } else if (blob.mood === BlobMood.Error && !surprised) {
    context.moveTo(x - size, y - size)
    context.lineTo(x + size, y + size)
    context.moveTo(x + size, y - size)
    context.lineTo(x - size, y + size)
    context.stroke()
  } else if (happy) {
    context.arc(x, y + radius * 0.05, radius * 0.1, Math.PI * 1.1, Math.PI * 1.9)
    context.stroke()
  } else if (sleeping) {
    context.arc(x, y - radius * 0.02, radius * 0.1, Math.PI * 0.15, Math.PI * 0.85)
    context.stroke()
  } else {
    const scale = surprised ? 1.35 : 1
    const openness = surprised ? 1 : Math.max(0.12, Math.abs(Math.cos((1 - blob.blink) * Math.PI)))
    context.ellipse(x, y, radius * 0.08 * scale, radius * 0.13 * scale * openness, 0, 0, Math.PI * 2)
    context.fill()
  }
}

const BLUSH = '#ff7a9a'
const HEART_POINTS: [number, number][] = [[0, 0.95], [-0.95, 0.05], [-0.95, -0.5], [-0.5, -0.9], [0, -0.5], [0.5, -0.9], [0.95, -0.5], [0.95, 0.05]]

const drawBlush = (context: CanvasRenderingContext2D, blob: Blob, radius: number, offsetX: number, offsetY: number): void => {
  context.save()
  context.globalAlpha = Math.min(1, (blob.pet - PETTED) * 3) * 0.6
  context.fillStyle = BLUSH
  for (const side of [-1, 1]) {
    context.beginPath()
    context.ellipse(side * radius * 0.5 + offsetX, offsetY + radius * 0.2, radius * 0.13, radius * 0.08, 0, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
  context.fillStyle = INK
  context.strokeStyle = INK
}

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

const drawFace = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number): void => {
  const { x: offsetX, y: offsetY } = faceOffset(blob, radius)
  context.lineCap = 'round'
  context.strokeStyle = INK
  context.fillStyle = INK
  context.lineWidth = radius * 0.07
  drawEye(context, world, blob, radius, -radius * 0.33 + offsetX, offsetY, -1)
  drawEye(context, world, blob, radius, radius * 0.33 + offsetX, offsetY, 1)
  if (blob.pet > PETTED && blob !== world.dragged) {
    drawBlush(context, blob, radius, offsetX, offsetY)
  }
  context.beginPath()
  if (blob !== world.dragged && sadOf(world, blob)) {
    if (painedOf(blob)) {
      context.ellipse(offsetX, offsetY + radius * 0.34, radius * 0.07, radius * 0.06, 0, 0, Math.PI * 2)
      context.fill()
    } else {
      context.arc(offsetX, offsetY + radius * 0.46, radius * 0.13, Math.PI * 1.2, Math.PI * 1.8)
      context.stroke()
    }
    return
  }
  if (blob !== world.dragged && blob.yawn > 0) {
    const opening = Math.sin((blob.yawn / 1.3) * Math.PI)
    context.ellipse(offsetX, offsetY + radius * 0.34, radius * 0.1, radius * (0.04 + opening * 0.14), 0, 0, Math.PI * 2)
  } else if (blob === world.dragged) {
    context.ellipse(offsetX, offsetY + radius * 0.32, radius * 0.08, radius * 0.1, 0, 0, Math.PI * 2)
  } else if (blob.mood === BlobMood.Done || blob.poke > 0 || blob.pet > PETTED) {
    context.ellipse(offsetX, offsetY + radius * 0.3, radius * 0.13, radius * 0.09, 0, 0, Math.PI)
  } else if (blob.mood === BlobMood.Waiting) {
    context.arc(offsetX, offsetY + radius * 0.3, radius * 0.05, 0, Math.PI * 2)
  }
  context.fill()
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

const drawHealthBar = (context: CanvasRenderingContext2D, blob: Blob, radius: number, top: number): void => {
  const width = Math.max(28, radius * 1.6)
  const x = blob.x - width / 2
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
  const radius = blob.radius * (blob.leaving ? Math.max(blob.grow, 0) : easeOutBack(blob.grow))
  if (radius <= 0.5 || blob.exploded > 0) {
    return
  }
  context.save()
  context.translate(blob.x + blob.shake * Math.sin(blob.clock * 60) * 6, blob.y)
  context.scale(1 + blob.squash, 1 - blob.squash)
  const points = outlinePoints(world, blob, radius)
  const lineWidth = Math.max(2.5, radius * 0.08)
  context.translate(0, -(lowestOf(points) + lineWidth / 2))
  context.fillStyle = colorOf(blob)
  context.strokeStyle = INK
  context.lineWidth = lineWidth
  context.lineJoin = 'round'
  outline(context, points)
  context.fill()
  context.stroke()
  drawFace(context, world, blob, radius)
  if (blob !== world.dragged) {
    drawProps(context, blob, radius)
  }
  context.restore()
  if (blob === world.dragged || blob.leaving || blob.grow < 1) {
    return
  }
  const waiting = blob.mood === BlobMood.Waiting
  const hovered = world.hovered === blob
  const top = blob.y - radius * 2 * (1 - blob.squash) - 8
  const barShown = world.gore && (blob.health < 1 || hovered)
  if (barShown) {
    drawHealthBar(context, blob, radius, top)
  }
  const label = labelOf(blob, hovered, waiting)
  if (label) {
    drawBubble(context, world, label, blob.x, barShown ? top - 10 : top, blob.y, waiting ? 0.08 * Math.sin(blob.moodTime * 6) : 0)
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
