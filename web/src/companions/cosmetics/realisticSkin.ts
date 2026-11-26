import { hashUnit, TAU } from './clayShapes'
import { cover, fillBody, insideBody, radialFill, strokeBody, type FaceState, type SkinPainting, type SkinStyle } from './skinPaint'

const NOISE_SIZE = 96
const NOISE_DOTS = 1500
const SACCADE_S = 0.7
const VEINS: number[][] = [[-0.6, -0.2, -0.45, -0.05, -0.3, 0.15, -0.15, 0.1], [0.3, -0.6, 0.45, -0.45, 0.55, -0.3, 0.7, -0.25], [-0.2, 0.5, -0.05, 0.45, 0.1, 0.6, 0.3, 0.55], [-0.75, 0.25, -0.6, 0.4, -0.5, 0.3, -0.35, 0.45]]
const WRINKLES: [number, number, number][] = [[-0.5, 0.8, 0.3], [0.1, 0.86, 0.38], [0.55, 0.76, 0.25]]

let noise: HTMLCanvasElement | null = null
const patterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern>()

const poresOf = (context: CanvasRenderingContext2D): CanvasPattern | null => {
  const cached = patterns.get(context)
  if (cached) {
    return cached
  }
  const pattern = context.createPattern(noiseCanvas(), 'repeat')
  if (pattern) {
    patterns.set(context, pattern)
  }
  return pattern
}

const noiseCanvas = (): HTMLCanvasElement => {
  if (noise) {
    return noise
  }
  noise = document.createElement('canvas')
  noise.width = NOISE_SIZE
  noise.height = NOISE_SIZE
  const context = noise.getContext('2d')
  for (let index = 0; context && index < NOISE_DOTS; index++) {
    context.fillStyle = Math.random() < 0.72 ? `rgba(95, 40, 30, ${0.12 + Math.random() * 0.35})` : `rgba(255, 236, 222, ${0.08 + Math.random() * 0.25})`
    context.beginPath()
    context.arc(Math.random() * NOISE_SIZE, Math.random() * NOISE_SIZE, Math.random() * 1.1 + 0.3, 0, TAU)
    context.fill()
  }
  return noise
}

const mix = (from: number, to: number, ratio: number): number => from + (to - from) * ratio

const quadraticAt = (start: number[], control: number[], end: number[], step: number): [number, number] => [
  (1 - step) ** 2 * start[0] + 2 * (1 - step) * step * control[0] + step ** 2 * end[0],
  (1 - step) ** 2 * start[1] + 2 * (1 - step) * step * control[1] + step ** 2 * end[1],
]

const paintSkin = (context: CanvasRenderingContext2D, { points, radius, time }: SkinPainting): void => {
  fillBody(context, points, radialFill(context, -radius * 0.35, -radius * 0.45, radius * 0.05, radius * 1.15, [[0, '#f6d3bf'], [0.45, '#dfa58c'], [0.8, '#b97360'], [1, '#7c4236']]))
  insideBody(context, points, () => {
    cover(context, radius, radialFill(context, 0, radius * 0.35, radius * 0.1, radius * 0.9, [[0, 'rgba(210, 80, 80, 0.22)'], [1, 'rgba(210, 80, 80, 0)']]))
    const pores = poresOf(context)
    if (pores) {
      context.save()
      context.globalAlpha = 0.38
      context.globalCompositeOperation = 'multiply'
      cover(context, radius, pores)
      context.restore()
    }
    context.strokeStyle = 'rgba(95, 70, 150, 0.22)'
    context.lineWidth = Math.max(0.6, radius * 0.014)
    context.lineCap = 'round'
    VEINS.forEach(([x0, y0, x1, y1, x2, y2, x3, y3]) => {
      context.beginPath()
      context.moveTo(x0 * radius, y0 * radius)
      context.bezierCurveTo(x1 * radius, y1 * radius, x2 * radius, y2 * radius, x3 * radius, y3 * radius)
      context.stroke()
    })
    const shade = context.createLinearGradient(0, radius * 0.3, 0, radius)
    shade.addColorStop(0, 'rgba(70, 25, 20, 0)')
    shade.addColorStop(1, 'rgba(70, 25, 20, 0.5)')
    context.fillStyle = shade
    context.fillRect(-radius * 2, radius * 0.3, radius * 4, radius)
    const breath = Math.sin(time * 1.3) * 0.015
    context.strokeStyle = 'rgba(85, 35, 30, 0.35)'
    context.lineWidth = Math.max(0.8, radius * 0.02)
    WRINKLES.forEach(([x, y, width]) => {
      context.beginPath()
      context.moveTo((x - width) * radius, (y + breath) * radius)
      context.quadraticCurveTo(x * radius, (y - 0.05 + breath) * radius, (x + width) * radius, (y + breath) * radius)
      context.stroke()
    })
    const shift = Math.sin(time * 0.8) * 0.03
    cover(context, radius, radialFill(context, (-0.42 + shift) * radius, -0.58 * radius, 0, radius * 0.34, [[0, 'rgba(255, 255, 255, 0.55)'], [1, 'rgba(255, 255, 255, 0)']]))
    context.fillStyle = 'rgba(255, 255, 255, 0.78)'
    context.beginPath()
    context.ellipse((-0.5 + shift) * radius, -0.65 * radius, radius * 0.06, radius * 0.03, -0.6, 0, TAU)
    context.fill()
    context.strokeStyle = 'rgba(60, 35, 25, 0.4)'
    context.lineWidth = Math.max(0.5, radius * 0.008)
    for (let index = 0; index < 16; index++) {
      const angle = -2.7 + index * 0.11
      const x = Math.cos(angle) * radius * 0.93
      const y = Math.sin(angle) * radius * 0.93
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + Math.cos(angle) * radius * 0.06 + Math.sin(time * 1.5 + index) * radius * 0.012, y + Math.sin(angle) * radius * 0.06)
      context.stroke()
    }
  })
  strokeBody(context, points, 'rgba(95, 45, 35, 0.55)', Math.max(1, radius * 0.025))
}

const drawRealEye = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number, hue: number, face: FaceState, side: number): void => {
  const width = radius * 0.2
  const height = radius * 0.105
  const jump = Math.floor(time / SACCADE_S)
  const irisX = x + face.look * width * 0.25 + (hashUnit(jump, side, 3) - 0.5) * width * 0.14
  const irisY = y + (hashUnit(jump, side + 5, 3) - 0.5) * height * 0.2
  const iris = height * 0.98
  context.fillStyle = radialFill(context, x, y, 0, width * 1.6, [[0, 'rgba(90, 38, 32, 0.4)'], [1, 'rgba(90, 38, 32, 0)']])
  context.beginPath()
  context.ellipse(x, y, width * 1.6, height * 1.9, 0, 0, TAU)
  context.fill()
  context.save()
  context.beginPath()
  context.moveTo(x - width, y)
  context.quadraticCurveTo(x, y - height * 1.6, x + width, y)
  context.quadraticCurveTo(x, y + height * 1.25, x - width, y)
  context.closePath()
  context.clip()
  cover(context, radius * 3, radialFill(context, x, y, 0, width, [[0, '#f8f2ea'], [0.7, '#efdcd2'], [1, '#d49a8f']]))
  context.strokeStyle = 'rgba(200, 45, 45, 0.35)'
  context.lineWidth = Math.max(0.4, radius * 0.006)
  for (let index = 0; index < 5; index++) {
    const startX = x + (index % 2 ? 1 : -1) * width * 0.95
    const startY = y + (hashUnit(index, side, 8) - 0.5) * height * 0.6
    context.beginPath()
    context.moveTo(startX, startY)
    context.quadraticCurveTo(mix(startX, x, 0.3), startY + (hashUnit(index, 2, side) - 0.5) * height, mix(startX, x, 0.55), y + (hashUnit(index, 4, side) - 0.5) * height * 0.5)
    context.stroke()
  }
  context.fillStyle = radialFill(context, irisX, irisY, iris * 0.15, iris, [[0, `hsl(${hue}, 38%, 58%)`], [0.65, `hsl(${hue}, 42%, 36%)`], [0.9, `hsl(${hue}, 40%, 17%)`], [1, 'rgba(18, 12, 12, 0.95)']])
  context.beginPath()
  context.arc(irisX, irisY, iris, 0, TAU)
  context.fill()
  context.strokeStyle = `hsla(${hue}, 55%, 78%, 0.28)`
  context.lineWidth = Math.max(0.4, radius * 0.005)
  for (let index = 0; index < 30; index++) {
    const angle = (index / 30) * TAU
    context.beginPath()
    context.moveTo(irisX + Math.cos(angle) * iris * 0.36, irisY + Math.sin(angle) * iris * 0.36)
    context.lineTo(irisX + Math.cos(angle + 0.12) * iris * 0.86, irisY + Math.sin(angle + 0.12) * iris * 0.86)
    context.stroke()
  }
  context.fillStyle = '#0a0707'
  context.beginPath()
  context.arc(irisX, irisY, iris * (0.36 + 0.07 * Math.sin(time * 0.7)), 0, TAU)
  context.fill()
  context.fillStyle = 'rgba(255, 255, 255, 0.95)'
  context.beginPath()
  context.ellipse(irisX - iris * 0.35, irisY - iris * 0.4, iris * 0.19, iris * 0.13, -0.5, 0, TAU)
  context.fill()
  const lidShade = context.createLinearGradient(0, y - height * 1.3, 0, y + height * 0.2)
  lidShade.addColorStop(0, 'rgba(60, 22, 18, 0.6)')
  lidShade.addColorStop(1, 'rgba(60, 22, 18, 0)')
  context.fillStyle = lidShade
  context.fillRect(x - width, y - height * 2, width * 2, height * 2.2)
  const start = [x - width, y]
  const control = [x, mix(y - height * 1.6, y + height * 1.3, face.blink)]
  const end = [x + width, y]
  context.fillStyle = radialFill(context, x, y - height * 1.5, 0, width * 1.4, [[0, '#e8b39b'], [1, '#c98670']])
  context.beginPath()
  context.moveTo(x - width * 1.2, y - height * 2.2)
  context.lineTo(x + width * 1.2, y - height * 2.2)
  context.lineTo(end[0], end[1])
  context.quadraticCurveTo(control[0], control[1], start[0], start[1])
  context.closePath()
  context.fill()
  context.restore()
  context.strokeStyle = 'rgba(110, 48, 38, 0.55)'
  context.lineWidth = Math.max(0.8, radius * 0.014)
  context.beginPath()
  context.moveTo(x - width * 0.95, y - height * 0.35)
  context.quadraticCurveTo(x, y - height * 2.4, x + width * 0.95, y - height * 0.35)
  context.stroke()
  context.strokeStyle = '#2e1612'
  context.lineWidth = Math.max(0.9, radius * 0.02)
  context.beginPath()
  context.moveTo(start[0], start[1])
  context.quadraticCurveTo(control[0], control[1], end[0], end[1])
  context.stroke()
  context.lineWidth = Math.max(0.5, radius * 0.009)
  for (let index = 1; index < 10; index++) {
    const step = index / 10
    const [lashX, lashY] = quadraticAt(start, control, end, step)
    const lean = (step - 0.5) * 1.4 + side * 0.25
    context.beginPath()
    context.moveTo(lashX, lashY)
    context.quadraticCurveTo(lashX + lean * height * 0.4, lashY - height * 0.45, lashX + lean * height * 0.75, lashY - height * 0.6)
    context.stroke()
  }
}

const drawLips = (context: CanvasRenderingContext2D, { radius, time }: SkinPainting): void => {
  context.fillStyle = 'rgba(70, 24, 20, 0.6)'
  ;[-1, 1].forEach((side) => {
    context.beginPath()
    context.ellipse(side * radius * 0.055, radius * 0.2, radius * 0.026, radius * 0.015, side * 0.35, 0, TAU)
    context.fill()
  })
  const y = radius * 0.42
  const width = radius * 0.25
  const gap = Math.max(0, Math.sin(time * 0.9) - 0.55) * radius * 0.12
  if (gap > 0.3) {
    context.fillStyle = '#2a0d0e'
    context.beginPath()
    context.ellipse(0, y + gap * 0.5, width * 0.8, gap * 0.65 + radius * 0.01, 0, 0, TAU)
    context.fill()
    context.fillStyle = '#efe6d2'
    context.fillRect(-width * 0.45, y - radius * 0.005, width * 0.9, Math.min(gap * 0.45, radius * 0.035))
  }
  const upper = context.createLinearGradient(0, y - radius * 0.08, 0, y + radius * 0.02)
  upper.addColorStop(0, '#c06763')
  upper.addColorStop(1, '#87393c')
  context.fillStyle = upper
  context.beginPath()
  context.moveTo(-width, y)
  context.quadraticCurveTo(-width * 0.5, y - radius * 0.075, -width * 0.12, y - radius * 0.058)
  context.quadraticCurveTo(0, y - radius * 0.03, width * 0.12, y - radius * 0.058)
  context.quadraticCurveTo(width * 0.5, y - radius * 0.075, width, y)
  context.quadraticCurveTo(0, y + radius * 0.018, -width, y)
  context.fill()
  const lower = context.createLinearGradient(0, y + gap, 0, y + gap + radius * 0.12)
  lower.addColorStop(0, '#b35a58')
  lower.addColorStop(1, '#cf7c77')
  context.fillStyle = lower
  context.beginPath()
  context.moveTo(-width * 0.9, y + gap)
  context.quadraticCurveTo(0, y + gap + radius * 0.13, width * 0.9, y + gap)
  context.quadraticCurveTo(0, y + gap + radius * 0.02, -width * 0.9, y + gap)
  context.fill()
  context.fillStyle = 'rgba(255, 255, 255, 0.32)'
  context.beginPath()
  context.ellipse(radius * 0.03, y + gap + radius * 0.055, width * 0.32, radius * 0.018, 0, 0, TAU)
  context.fill()
}

export const REALISTIC_SKIN: SkinStyle = {
  back: (context, { radius }) => {
    context.fillStyle = radialFill(context, 0, radius * 0.98, 0, radius * 1.1, [[0, 'rgba(0, 0, 0, 0.55)'], [1, 'rgba(0, 0, 0, 0)']])
    context.beginPath()
    context.ellipse(0, radius * 0.98, radius * 1.15, radius * 0.17, 0, 0, TAU)
    context.fill()
  },
  paint: paintSkin,
  eyes: (context, painting, face) => {
    ;[-1, 1].forEach((side) => drawRealEye(context, side * painting.radius * 0.31, -painting.radius * 0.16, painting.radius, painting.time, painting.hue, face, side))
    drawLips(context, painting)
  },
}
