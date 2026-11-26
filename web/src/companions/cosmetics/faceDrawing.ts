import { CompanionFace } from './cosmeticCatalog'
import { drawClayParts, ring, smoothstep, type ClayPart } from './clayShapes'

const EYE_LEVEL = -0.12
const PIXEL_UNIT = 0.1
const PIXEL_DROP_PERIOD_S = 6
const PIXEL_DROP_SHARE = 0.18
const PIXEL_SHADES = ['XXXXXXXXXXXXXXX', '.XWWXXX.XWWXXX.', '.XXWWXX.XXWWXX.', '..XXXX...XXXX..']

const pixelShades = (drop: number): ClayPart[] =>
  PIXEL_SHADES.flatMap((row, line) =>
    [...row].flatMap((cell, column): ClayPart[] => {
      if (cell === '.') {
        return []
      }
      const x = -0.75 + column * PIXEL_UNIT
      const y = -0.34 + drop + line * PIXEL_UNIT
      const size = PIXEL_UNIT + 0.006
      return [{ points: [[x, y], [x + size, y], [x + size, y + size], [x, y + size]], fill: cell === 'W' ? '#ffffff' : '#15121f', sharp: true, noLine: true }]
    }),
  )

const FACES: Record<CompanionFace, (time: number) => ClayPart[]> = {
  [CompanionFace.Mustache]: (time) => {
    const wiggle = Math.sin(time * 6) * 0.05
    return [{ points: [[0, 0.1], [-0.22, 0.03], [-0.5, 0.06], [-0.72, 0.22 + wiggle], [-0.46, 0.34], [-0.22, 0.27], [0, 0.24], [0.22, 0.27], [0.46, 0.34], [0.72, 0.22 - wiggle], [0.5, 0.06], [0.22, 0.03]], fill: '#7a4a2a' }]
  },
  [CompanionFace.Monocle]: () => [
    { points: ring(0.33, -0.12, 0.25, 0.25, 12), fill: 'rgba(190, 225, 255, 0.45)', noLine: true },
    { stroke: ring(0.33, -0.12, 0.25, 0.25, 12), color: '#ffd84a', width: 0.09, closed: true },
    { stroke: [[0.56, 0], [0.74, 0.4], [0.5, 0.78]], color: '#ffd84a', width: 0.06 },
  ],
  [CompanionFace.ClownNose]: (time) => [
    { points: ring(0, 0.1, 0.17 + Math.sin(time * 4) * 0.01, 0.16, 10), fill: '#ff3b4a' },
    { stroke: [[-0.07, 0.03], [-0.03, 0.01]], color: '#ffffff', width: 0.06, bare: true },
  ],
  [CompanionFace.EyePatch]: () => [
    { stroke: [[-0.95, -0.62], [0.95, 0.3]], color: '#2a2440', width: 0.05 },
    { points: ring(0.33, -0.11, 0.22, 0.2, 12), fill: '#2a2440' },
  ],
  [CompanionFace.HeroMask]: (time) => {
    const flutter = Math.sin(time * 7) * 0.08
    return [
      { stroke: [[0.88, -0.16], [1.15, -0.1 + flutter], [1.36, 0.02 - flutter]], color: '#e0405a', width: 0.1 },
      { stroke: [[0.88, -0.08], [1.1, 0.08 - flutter], [1.24, 0.26 + flutter]], color: '#e0405a', width: 0.1 },
      { points: [[-0.95, -0.34], [-0.6, -0.42], [0, -0.34], [0.6, -0.42], [0.95, -0.34], [0.95, 0.06], [0.6, 0.1], [0, 0.02], [-0.6, 0.1], [-0.95, 0.06]], fill: '#e0405a' },
      { points: ring(-0.33, -0.14, 0.18, 0.15, 12), fill: '#ffffff', lineScale: 0.6 },
      { points: ring(0.33, -0.14, 0.18, 0.15, 12), fill: '#ffffff', lineScale: 0.6 },
      { eyes: true },
    ]
  },
  [CompanionFace.PixelShades]: (time) => {
    const phase = (time % PIXEL_DROP_PERIOD_S) / PIXEL_DROP_PERIOD_S
    return pixelShades(phase < PIXEL_DROP_SHARE ? -(1 - smoothstep(phase / PIXEL_DROP_SHARE)) * 1.7 : 0)
  },
}

export const drawFaceCosmetic = (context: CanvasRenderingContext2D, face: string, time: number, radius: number, offsetX: number, offsetY: number, drawEyes: () => void): void => {
  const parts = FACES[face as CompanionFace]
  if (!parts) {
    return
  }
  context.save()
  context.translate(offsetX, offsetY - EYE_LEVEL * radius)
  drawClayParts(context, parts(time), time, radius, () => {
    context.save()
    context.translate(-offsetX, -(offsetY - EYE_LEVEL * radius))
    drawEyes()
    context.restore()
  })
  context.restore()
}
