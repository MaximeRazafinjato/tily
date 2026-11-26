const SPAN = 7
const BASE = 1.5

type Paint = (context: CanvasRenderingContext2D) => void

const canvases: { pixel: HTMLCanvasElement | null; tint: HTMLCanvasElement | null } = { pixel: null, tint: null }

const canvasFor = (kind: 'pixel' | 'tint'): HTMLCanvasElement => {
  canvases[kind] ??= document.createElement('canvas')
  return canvases[kind]
}

const renderOffscreen = (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, radius: number, scale: number, paint: Paint, pixelated: boolean, tint?: string): void => {
  const size = Math.max(1, Math.ceil(radius * SPAN * scale))
  const base = Math.round(radius * BASE * scale)
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size
    canvas.height = size
  }
  const target = canvas.getContext('2d')
  if (!target) {
    return
  }
  target.setTransform(1, 0, 0, 1, 0, 0)
  target.globalCompositeOperation = 'source-over'
  target.globalAlpha = 1
  target.clearRect(0, 0, size, size)
  target.setTransform(scale, 0, 0, scale, size / 2, size - base)
  paint(target)
  if (tint) {
    target.setTransform(1, 0, 0, 1, 0, 0)
    target.globalCompositeOperation = 'source-atop'
    target.fillStyle = tint
    target.fillRect(0, 0, size, size)
  }
  context.save()
  context.imageSmoothingEnabled = !pixelated
  context.drawImage(canvas, -size / 2 / scale, -(size - base) / scale, size / scale, size / scale)
  context.restore()
}

export const drawPixelated = (context: CanvasRenderingContext2D, radius: number, pixel: number, paint: Paint): void => renderOffscreen(context, canvasFor('pixel'), radius, 1 / pixel, paint, true)

export const drawTinted = (context: CanvasRenderingContext2D, radius: number, color: string, paint: Paint): void =>
  renderOffscreen(context, canvasFor('tint'), radius, Math.max(1, Math.hypot(context.getTransform().a, context.getTransform().b)), paint, false, color)
