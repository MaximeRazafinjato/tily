import { hexToRgb } from '../renderPacing'

export const ALERT_MS = 2000
export const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)'

const LAYER_ID = 'tily-ambiance-alerts'
const MAX_STEP = 4
const FRAME_MS = 16.67
const FADE_SHARE = 0.25

export type CanvasDraw = (progress: number, step: number, fade: number) => void

export const easeOut = (progress: number): number => 1 - (1 - progress) ** 4

export const easedFrames = (frames: Keyframe[]): Keyframe[] => frames.map((frame) => ({ easing: EASE_OUT, ...frame }))

export const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min)

export const pick = <T>(list: ArrayLike<T>): T => list[Math.floor(Math.random() * list.length)]

const mixRgb = (rgb: number[], target: number[], ratio: number): string => `rgb(${rgb.map((channel, index) => Math.round(channel + (target[index] - channel) * ratio)).join(' ')})`

export const shadesOf = (color: string): string[] => [color, mixRgb(hexToRgb(color), [255, 255, 255], 0.5), mixRgb(hexToRgb(color), [0, 0, 0], 0.35)]

export const inverseOf = (color: string): string => `rgb(${hexToRgb(color).map((channel) => 255 - channel).join(' ')})`

const alertLayer = (): HTMLElement => {
  const existing = document.getElementById(LAYER_ID)
  if (existing) {
    return existing
  }
  const layer = document.createElement('div')
  layer.id = LAYER_ID
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: '2147483000', pointerEvents: 'none', overflow: 'hidden' })
  document.body.append(layer)
  return layer
}

export const spawnOverlay = <K extends keyof HTMLElementTagNameMap>(tag: K, style: Partial<CSSStyleDeclaration>): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag)
  Object.assign(element.style, style)
  alertLayer().append(element)
  return element
}

export const appRoot = (): HTMLElement | null => document.getElementById('root')

export const removeWhenDone = (element: HTMLElement, animation: Animation): void => {
  void animation.finished.then(() => element.remove()).catch(() => element.remove())
}

export const animateCanvas = (duration: number, setup: (context: CanvasRenderingContext2D, width: number, height: number) => CanvasDraw): void => {
  const canvas = spawnOverlay('canvas', { position: 'absolute', inset: '0' })
  canvas.width = innerWidth
  canvas.height = innerHeight
  const context = canvas.getContext('2d')
  if (!context) {
    canvas.remove()
    return
  }
  const draw = setup(context, canvas.width, canvas.height)
  const start = performance.now()
  let previous = start
  const frame = (now: number) => {
    const elapsed = now - start
    if (elapsed >= duration) {
      canvas.remove()
      return
    }
    const step = Math.min(MAX_STEP, (now - previous) / FRAME_MS)
    previous = now
    draw(elapsed / duration, step, 1 - easeOut(Math.max(0, 1 - (duration - elapsed) / (duration * FADE_SHARE))))
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
