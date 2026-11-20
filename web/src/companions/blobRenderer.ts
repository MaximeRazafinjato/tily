import { BlobMood, lerp, ParticleKind, SHAPES, SLEEP_AFTER_S, type Blob, type World } from './blobModel'

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
  return [blob.name, activity].filter(Boolean).join(' · ')
}

const easeOutBack = (progress: number): number => 1 + 2.7 * (progress - 1) ** 3 + 1.7 * (progress - 1) ** 2

const colorOf = (blob: Blob): string => {
  const errorHue = ERROR_HUE + (blob.hue > 180 ? 360 : 0)
  return `hsl(${lerp(blob.hue, errorHue, blob.errorMix)}, 85%, ${lerp(64, 52, blob.errorMix)}%)`
}

const outline = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number): void => {
  const { sides, rotation } = SHAPES[blob.shape]
  const { energy, speed } = blob === world.dragged ? DRAGGED_WOBBLE : WOBBLE[blob.mood]
  const time = blob.clock * speed
  const sector = (Math.PI * 2) / sides
  const points: [number, number][] = []
  for (let index = 0; index < OUTLINE_POINTS; index++) {
    const angle = (index / OUTLINE_POINTS) * Math.PI * 2
    const local = (((angle - rotation) % sector) + sector) % sector - sector / 2
    const polygon = sides ? Math.cos(sector / 2) / Math.cos(local) : 1
    const distance = radius * lerp(polygon, 1, CORNER_ROUNDING) * (1 + energy * Math.sin(time + angle * 3) + energy * 0.6 * Math.sin(time * 1.37 + angle * 5))
    points.push([Math.cos(angle) * distance, Math.sin(angle) * distance])
  }
  const middle = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = middle(points[OUTLINE_POINTS - 1], points[0])
  context.beginPath()
  context.moveTo(start[0], start[1])
  points.forEach((point, index) => {
    const next = middle(point, points[(index + 1) % OUTLINE_POINTS])
    context.quadraticCurveTo(point[0], point[1], next[0], next[1])
  })
  context.closePath()
}

const drawEye = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number, x: number, y: number): void => {
  const surprised = blob === world.dragged
  const happy = !surprised && (blob.mood === BlobMood.Done || blob.poke > 0)
  const sleeping = !surprised && blob.mood === BlobMood.Idle && blob.idleTime > SLEEP_AFTER_S
  context.beginPath()
  if (blob.dizzy > 0 && !surprised) {
    for (let step = 0; step <= 24; step++) {
      const angle = step * 0.55 + blob.clock * 8
      const distance = (step / 24) * radius * 0.13
      context.lineTo(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance)
    }
    context.stroke()
  } else if (blob.mood === BlobMood.Error && !surprised) {
    const size = radius * 0.1
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

const drawFace = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number): void => {
  const offsetX = blob.lookX * radius * 0.12
  const offsetY = blob.lookY * radius * 0.1 - radius * 0.12
  context.lineCap = 'round'
  context.strokeStyle = INK
  context.fillStyle = INK
  context.lineWidth = radius * 0.07
  drawEye(context, world, blob, radius, -radius * 0.33 + offsetX, offsetY)
  drawEye(context, world, blob, radius, radius * 0.33 + offsetX, offsetY)
  context.beginPath()
  if (blob === world.dragged) {
    context.ellipse(offsetX, offsetY + radius * 0.32, radius * 0.08, radius * 0.1, 0, 0, Math.PI * 2)
  } else if (blob.mood === BlobMood.Done || blob.poke > 0) {
    context.ellipse(offsetX, offsetY + radius * 0.3, radius * 0.13, radius * 0.09, 0, 0, Math.PI)
  } else if (blob.mood === BlobMood.Waiting) {
    context.arc(offsetX, offsetY + radius * 0.3, radius * 0.05, 0, Math.PI * 2)
  }
  context.fill()
}

const drawBubble = (context: CanvasRenderingContext2D, text: string, x: number, y: number, pulse: number): void => {
  context.font = '600 12px system-ui, sans-serif'
  const width = context.measureText(text).width + 16
  context.save()
  context.translate(x, y)
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

export const drawBlob = (context: CanvasRenderingContext2D, world: World, blob: Blob): void => {
  const radius = blob.radius * (blob.leaving ? Math.max(blob.grow, 0) : easeOutBack(blob.grow))
  if (radius <= 0.5 || blob.exploded > 0) {
    return
  }
  context.save()
  context.translate(blob.x + blob.shake * Math.sin(blob.clock * 60) * 6, blob.y)
  context.scale(1 + blob.squash, 1 - blob.squash)
  context.translate(0, -radius)
  context.fillStyle = colorOf(blob)
  context.strokeStyle = INK
  context.lineWidth = Math.max(2.5, radius * 0.08)
  context.lineJoin = 'round'
  outline(context, world, blob, radius)
  context.fill()
  context.stroke()
  drawFace(context, world, blob, radius)
  context.restore()
  if (blob === world.dragged || blob.leaving || blob.grow < 1) {
    return
  }
  const waiting = blob.mood === BlobMood.Waiting
  const label = labelOf(blob, world.hovered === blob, waiting)
  if (label) {
    drawBubble(context, label, blob.x, blob.y - radius * 2 * (1 - blob.squash) - 8, waiting ? 0.08 * Math.sin(blob.moodTime * 6) : 0)
  }
}

export const drawParticles = (context: CanvasRenderingContext2D, world: World): void => {
  world.particles.forEach((particle) => {
    context.globalAlpha = Math.max(0, particle.life)
    if (particle.kind === ParticleKind.Stain) {
      return
    }
    if (particle.kind === ParticleKind.Drop) {
      context.fillStyle = `hsl(${particle.hue}, 85%, 38%)`
      context.beginPath()
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      context.fill()
    } else if (particle.kind === ParticleKind.Spark) {
      context.fillStyle = `hsl(${particle.hue}, 90%, 65%)`
      context.beginPath()
      context.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2)
      context.fill()
    } else {
      context.fillStyle = '#c9cfe0'
      context.font = `700 ${particle.size}px system-ui, sans-serif`
      context.fillText('z', particle.x, particle.y)
    }
  })
  context.globalAlpha = 1
}

export const drawStains = (context: CanvasRenderingContext2D, world: World): void => {
  world.particles
    .filter((particle) => particle.kind === ParticleKind.Stain)
    .forEach((particle) => {
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
