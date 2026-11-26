import type { CompanionOutfit } from '../bridge/appearanceMessages'
import { HURT_S, SAD_HEALTH } from './goreEffects'
import { BlobMood, lerp, PETTED, SHAPES, type Blob, type World } from './blobModel'
import { drawProps, faceOffset } from './blobProps'
import { INK, type Point } from './cosmetics/clayShapes'
import type { FigurePose } from './cosmetics/cosmeticState'
import { drawFaceCosmetic } from './cosmetics/faceDrawing'
import { drawHat } from './cosmetics/hatDrawing'
import { drawPixelated } from './cosmetics/offscreenFigure'
import { blinkOf, type FaceState, type SkinPainting } from './cosmetics/skinPaint'
import { outlineCount, pixelSize, pixelTime, skinStyle } from './cosmetics/skinDrawing'

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
const BLUSH = '#ff7a9a'

export const colorOf = (blob: Blob, hue = blob.hue): string => {
  const errorHue = ERROR_HUE + (hue > 180 ? 360 : 0)
  return `hsl(${lerp(hue, errorHue, blob.errorMix)}, 85%, ${lerp(64, 52, blob.errorMix)}%)`
}

const middle = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

const outlinePoints = (world: World, blob: Blob, radius: number, clock: number, count: number): Point[] => {
  const { sides, rotation } = SHAPES[blob.shape]
  const { energy, speed } = blob === world.dragged ? DRAGGED_WOBBLE : WOBBLE[blob.mood]
  const time = clock * speed
  const sector = (Math.PI * 2) / sides
  return Array.from({ length: count }, (_, index): Point => {
    const angle = (index / count) * Math.PI * 2
    const local = ((((angle - rotation) % sector) + sector) % sector) - sector / 2
    const polygon = sides ? Math.cos(sector / 2) / Math.cos(local) : 1
    const distance = radius * lerp(polygon, 1, CORNER_ROUNDING) * (1 + energy * Math.sin(time + angle * 3) + energy * 0.6 * Math.sin(time * 1.37 + angle * 5))
    return [Math.cos(angle) * distance, Math.sin(angle) * distance]
  })
}

const lowestOf = (points: Point[]): number =>
  Math.max(...points.map((point, index) => (middle(points[(index + points.length - 1) % points.length], point)[1] + 2 * point[1] + middle(point, points[(index + 1) % points.length])[1]) / 4))

const painedOf = (blob: Blob): boolean => blob.hurt > HURT_S - 0.5

const sadOf = (world: World, blob: Blob): boolean => world.gore && (blob.hurt > 0 || blob.health < SAD_HEALTH)

const sleepingOf = (world: World, blob: Blob): boolean => (blob.mood === BlobMood.Idle && blob.idleTime > world.sleepAfter) || blob.yawn > 0

const happyOf = (blob: Blob): boolean => blob.mood === BlobMood.Done || blob.poke > 0 || blob.pet > PETTED

const drawEye = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number, x: number, y: number, side: number, ink: string): void => {
  const surprised = blob === world.dragged
  const size = radius * 0.1
  const sad = !surprised && sadOf(world, blob)
  const happy = !surprised && !sad && happyOf(blob)
  const sleeping = !surprised && sleepingOf(world, blob)
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
      context.fillStyle = ink
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
}

const drawMouth = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number, offsetX: number, offsetY: number): void => {
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
  } else if (happyOf(blob)) {
    context.ellipse(offsetX, offsetY + radius * 0.3, radius * 0.13, radius * 0.09, 0, 0, Math.PI)
  } else if (blob.mood === BlobMood.Waiting) {
    context.arc(offsetX, offsetY + radius * 0.3, radius * 0.05, 0, Math.PI * 2)
  }
  context.fill()
}

const drawFace = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number, ink: string, glow: boolean): void => {
  const { x: offsetX, y: offsetY } = faceOffset(blob, radius)
  context.save()
  context.lineCap = 'round'
  context.strokeStyle = ink
  context.fillStyle = ink
  context.lineWidth = radius * 0.07
  if (glow) {
    context.shadowColor = ink
    context.shadowBlur = radius * 0.3
  }
  drawEye(context, world, blob, radius, -radius * 0.33 + offsetX, offsetY, -1, ink)
  drawEye(context, world, blob, radius, radius * 0.33 + offsetX, offsetY, 1, ink)
  if (blob.pet > PETTED && blob !== world.dragged) {
    drawBlush(context, blob, radius, offsetX, offsetY)
  }
  drawMouth(context, world, blob, radius, offsetX, offsetY)
  context.restore()
}

const faceStateOf = (world: World, blob: Blob, time: number): FaceState => {
  const closed = blob !== world.dragged && (sleepingOf(world, blob) || happyOf(blob))
  return { look: blob.lookX, blink: closed ? 0.8 : Math.max(blinkOf(time), 1 - blob.blink) }
}

const paintFigure = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number, outfit: CompanionOutfit, pose: FigurePose): void => {
  const style = skinStyle(outfit.skin)
  const time = pose.time
  const raw = outlinePoints(world, blob, radius, time, outlineCount(outfit.skin, OUTLINE_POINTS))
  const points = style.outline ? style.outline(raw, radius, time) : raw
  const line = Math.max(2.5, radius * 0.08)
  const top = Math.min(...points.map(([, y]) => y)) / radius
  context.save()
  context.scale((1 + blob.squash) * pose.sx, (1 - blob.squash) * pose.sy)
  context.translate(0, -(lowestOf(points) + line / 2) - (style.lift?.(radius, time) ?? 0))
  context.rotate(pose.rotation)
  const painting: SkinPainting = { points, radius, time, hue: pose.hue, color: colorOf(blob, pose.hue), line }
  const face = faceStateOf(world, blob, time)
  const step = (draw: () => void): void => {
    context.save()
    draw()
    context.restore()
  }
  if (style.back) {
    step(() => style.back?.(context, painting))
  }
  step(() => style.paint(context, painting))
  const ink = style.eyeColor?.(pose.hue) ?? INK
  const drawEyes = (): void => {
    if (style.eyes) {
      const { x, y } = faceOffset(blob, radius)
      step(() => {
        context.translate(x, y + radius * 0.12)
        style.eyes?.(context, painting, face)
      })
      return
    }
    drawFace(context, world, blob, radius, ink, Boolean(style.glow))
  }
  drawEyes()
  if (style.front) {
    step(() => style.front?.(context, painting, face))
  }
  if (outfit.face) {
    const { x, y } = faceOffset(blob, radius)
    step(() => drawFaceCosmetic(context, outfit.face ?? '', time, radius, x, y, drawEyes))
  }
  if (blob !== world.dragged) {
    drawProps(context, blob, radius)
  }
  if (outfit.hat) {
    step(() => drawHat(context, outfit.hat ?? '', time, radius, top))
  }
  context.restore()
}

export const drawFigure = (context: CanvasRenderingContext2D, world: World, blob: Blob, radius: number, outfit: CompanionOutfit, pose: FigurePose): void => {
  const pixel = pixelSize(outfit.skin, radius)
  if (pixel > 0) {
    drawPixelated(context, radius, pixel, (target) => paintFigure(target, world, blob, radius, outfit, { ...pose, time: pixelTime(pose.time) }))
    return
  }
  paintFigure(context, world, blob, radius, outfit, pose)
}
