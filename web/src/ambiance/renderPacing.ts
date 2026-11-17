import type { AmbianceGradient, AmbiancePerformance } from '../bridge/appearanceMessages'

const FRAME_TOLERANCE_MS = 2
const REFERENCE_DURATION_S = 12

export type AmbianceReader = () => { gradient: AmbianceGradient; performance: AmbiancePerformance }

export const shouldRender = (performance: AmbiancePerformance, now: number, previous: number): boolean =>
  !(performance.pauseInactive && (document.hidden || !document.hasFocus())) && now - previous >= 1000 / performance.fpsLimit - FRAME_TOLERANCE_MS

export const speedOf = (gradient: AmbianceGradient): number => (gradient.duration > 0 ? (REFERENCE_DURATION_S / gradient.duration) * (gradient.reverse ? -1 : 1) : 0)

export const hexToRgb = (hex: string): [number, number, number] => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [number, number, number]

export const fitCanvas = (canvas: HTMLCanvasElement, scale: number): void => {
  const width = Math.max(1, Math.round(canvas.clientWidth * scale))
  const height = Math.max(1, Math.round(canvas.clientHeight * scale))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
}
