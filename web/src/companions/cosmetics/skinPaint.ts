import { INK, tracePath, type Point } from './clayShapes'

export interface SkinPainting {
  points: Point[]
  radius: number
  time: number
  hue: number
  color: string
  line: number
}

export interface FaceState {
  look: number
  blink: number
}

export interface SkinStyle {
  paint: (context: CanvasRenderingContext2D, painting: SkinPainting) => void
  back?: (context: CanvasRenderingContext2D, painting: SkinPainting) => void
  front?: (context: CanvasRenderingContext2D, painting: SkinPainting, face: FaceState) => void
  eyes?: (context: CanvasRenderingContext2D, painting: SkinPainting, face: FaceState) => void
  outline?: (points: Point[], radius: number, time: number) => Point[]
  lift?: (radius: number, time: number) => number
  eyeColor?: (hue: number) => string
  glow?: boolean
  pixelated?: boolean
}

export const fillBody = (context: CanvasRenderingContext2D, points: Point[], color: string | CanvasGradient): void => {
  tracePath(context, points, true, true)
  context.fillStyle = color
  context.fill()
}

export const strokeBody = (context: CanvasRenderingContext2D, points: Point[], color: string, width: number): void => {
  tracePath(context, points, true, true)
  context.strokeStyle = color
  context.lineWidth = width
  context.lineJoin = 'round'
  context.stroke()
}

export const insideBody = (context: CanvasRenderingContext2D, points: Point[], paint: () => void): void => {
  context.save()
  tracePath(context, points, true, true)
  context.clip()
  paint()
  context.restore()
}

export const radialFill = (context: CanvasRenderingContext2D, x: number, y: number, from: number, to: number, stops: [number, string][]): CanvasGradient => {
  const gradient = context.createRadialGradient(x, y, from, x, y, to)
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  return gradient
}

export const cover = (context: CanvasRenderingContext2D, radius: number, fill: string | CanvasGradient | CanvasPattern): void => {
  context.fillStyle = fill
  context.fillRect(-radius * 2, -radius * 2.5, radius * 4, radius * 5)
}

export const plainPaint = (context: CanvasRenderingContext2D, { points, color, line }: SkinPainting): void => {
  fillBody(context, points, color)
  strokeBody(context, points, INK, line)
}

export const blinkOf = (time: number): number => {
  const phase = time % 4.3
  return phase > 4.12 ? Math.sin(((phase - 4.12) / 0.18) * Math.PI) : 0
}
