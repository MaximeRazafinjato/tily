import { CompanionHat } from './cosmeticCatalog'
import { arc, densify, drawClayParts, mirror, puff, ring, roundedBox, TAU, type ClayPart, type Point } from './clayShapes'

const VIKING_HORN: Point[] = [[-0.55, -0.95], [-0.85, -1.0], [-1.08, -1.25], [-1.15, -1.62], [-1.02, -1.88], [-0.97, -1.55], [-0.85, -1.32], [-0.55, -1.22]]

const HATS: Record<CompanionHat, (time: number) => ClayPart[]> = {
  [CompanionHat.Cap]: () => [
    { points: arc(0, -0.74, 0.66, 0.62, Math.PI, TAU, 12), fill: '#f07a70' },
    { points: ring(0.55, -0.76, 0.55, 0.15), fill: '#e0605a' },
    { points: ring(0, -1.36, 0.1, 0.1, 8), fill: '#f07a70' },
  ],
  [CompanionHat.Crown]: () => [
    { points: densify([[-0.62, -0.68], [-0.72, -1.48], [-0.32, -1.1], [0, -1.66], [0.32, -1.1], [0.72, -1.48], [0.62, -0.68]]), fill: '#ffd84a' },
    { points: ring(0, -0.95, 0.13, 0.13, 10), fill: '#f07a70' },
  ],
  [CompanionHat.TopHat]: () => [
    { points: ring(0, -0.86, 0.8, 0.14, 20), fill: '#4a4170' },
    { points: roundedBox(-0.44, -1.78, 0.44, -0.88, 0.1), fill: '#4a4170' },
    { points: roundedBox(-0.44, -1.12, 0.44, -0.9, 0.04), fill: '#e0405a' },
    { stroke: [[-0.3, -1.66], [-0.3, -1.28]], color: '#6e64a0', width: 0.07, bare: true },
  ],
  [CompanionHat.Beanie]: (time) => [
    { points: arc(0, -0.7, 0.7, 0.72, Math.PI, TAU, 14), fill: '#5ab4ff' },
    { points: roundedBox(-0.76, -0.88, 0.76, -0.62, 0.12), fill: '#a8d8ff' },
    { points: ring(Math.sin(time * 5) * 0.06, -1.52, 0.22, 0.2, 12), fill: '#ffffff' },
  ],
  [CompanionHat.Viking]: () => [
    { points: VIKING_HORN, fill: '#f3ecd8' },
    { points: mirror(VIKING_HORN), fill: '#f3ecd8' },
    { points: arc(0, -0.72, 0.68, 0.68, Math.PI, TAU, 14), fill: '#9aa3b5' },
    { points: roundedBox(-0.74, -0.88, 0.74, -0.66, 0.1), fill: '#c28a52' },
    ...[-0.45, 0, 0.45].map((x): ClayPart => ({ points: ring(x, -0.77, 0.055, 0.055, 6), fill: '#ffd84a', lineScale: 0.5 })),
  ],
  [CompanionHat.Cowboy]: () => [
    { points: [[-0.45, -0.8], [-0.5, -1.35], [-0.2, -1.45], [0, -1.32], [0.2, -1.45], [0.5, -1.35], [0.45, -0.8]], fill: '#c28a52' },
    { points: roundedBox(-0.47, -1.0, 0.47, -0.84, 0.04), fill: '#5a3820' },
    { points: [[-1.1, -1.05], [-0.85, -0.82], [0, -0.74], [0.85, -0.82], [1.1, -1.05], [0.95, -0.7], [0, -0.6], [-0.95, -0.7]], fill: '#b07a44' },
  ],
  [CompanionHat.Chef]: (time) => [
    { points: puff(0, -1.36 + Math.sin(time * 2.4) * 0.03, 0.62, 0.4, 5, 0.16), fill: '#ffffff' },
    { points: roundedBox(-0.5, -1.08, 0.5, -0.78, 0.06), fill: '#eceef4' },
    { stroke: [[-0.22, -1.02], [-0.22, -0.84]], color: '#c9cdd8', width: 0.04, bare: true },
    { stroke: [[0.18, -1.02], [0.18, -0.84]], color: '#c9cdd8', width: 0.04, bare: true },
  ],
  [CompanionHat.Propeller]: (time) => {
    const turn = Math.cos(time * 14)
    const blade = Math.max(0.04, 0.34 * Math.abs(turn))
    return [
      { points: [[0, -0.72], ...arc(0, -0.72, 0.66, 0.62, Math.PI, Math.PI * 1.5, 6)], fill: '#f07a70' },
      { points: [[0, -0.72], ...arc(0, -0.72, 0.66, 0.62, Math.PI * 1.5, TAU, 6)], fill: '#5ab4ff' },
      { points: ring(0.5, -0.76, 0.42, 0.12), fill: '#ffd84a' },
      { stroke: [[0, -1.32], [0, -1.58]], color: '#ffd84a', width: 0.07 },
      { points: ring(0.34 * turn, -1.62, blade, 0.08, 12), fill: '#ffd84a' },
      { points: ring(-0.34 * turn, -1.62, blade, 0.08, 12), fill: '#3fd37c' },
      { points: ring(0, -1.62, 0.07, 0.07, 8), fill: '#f07a70', lineScale: 0.6 },
    ]
  },
}

export const drawHat = (context: CanvasRenderingContext2D, hat: string, time: number, radius: number, top: number): void => {
  const parts = HATS[hat as CompanionHat]
  if (!parts) {
    return
  }
  context.save()
  context.translate(0, (top + 1) * radius)
  drawClayParts(context, parts(time), time, radius)
  context.restore()
}
