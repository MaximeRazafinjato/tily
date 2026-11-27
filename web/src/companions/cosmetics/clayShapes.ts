export const INK = '#1a1530'
export const TAU = Math.PI * 2

export type Point = [number, number]

export interface ClayPart {
  points?: Point[]
  fill?: string
  stroke?: Point[]
  color?: string
  width?: number
  closed?: boolean
  bare?: boolean
  sharp?: boolean
  noLine?: boolean
  alpha?: number
  lineScale?: number
  eyes?: boolean
}

const WOBBLE = 0.028

export const clayLine = (radius: number): number => Math.max(2.2, radius * 0.085)

export const arc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, steps: number): Point[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const angle = from + ((to - from) * index) / steps
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]
  })

export const ring = (cx: number, cy: number, rx: number, ry: number, steps = 18): Point[] => arc(cx, cy, rx, ry, 0, TAU, steps).slice(0, -1)

export const star = (cx: number, cy: number, size: number, inner = 0.42, tips = 4): Point[] =>
  Array.from({ length: tips * 2 }, (_, index) => {
    const angle = (index * Math.PI) / tips - Math.PI / 2
    const distance = index % 2 ? size * inner : size
    return [cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance]
  })

export const roundedBox = (x0: number, y0: number, x1: number, y1: number, corner = 0.06): Point[] => [
  [x0 + corner, y0],
  [x1 - corner, y0],
  [x1, y0 + corner],
  [x1, y1 - corner],
  [x1 - corner, y1],
  [x0 + corner, y1],
  [x0, y1 - corner],
  [x0, y0 + corner],
]

export const mirror = (points: Point[]): Point[] => points.map(([x, y]) => [-x, y])

export const densify = (points: Point[], steps = 2): Point[] =>
  points.flatMap((point, index) => {
    const next = points[(index + 1) % points.length]
    return Array.from({ length: steps }, (_, step): Point => [point[0] + ((next[0] - point[0]) * step) / steps, point[1] + ((next[1] - point[1]) * step) / steps])
  })

export const puff = (cx: number, cy: number, rx: number, ry: number, bumps: number, amount: number): Point[] =>
  Array.from({ length: 40 }, (_, index) => {
    const angle = (index / 40) * TAU
    const bump = Math.sin(angle) < 0 ? 1 + amount * Math.abs(Math.sin((angle * bumps) / 2)) : 1
    return [cx + Math.cos(angle) * rx * bump, cy + Math.sin(angle) * ry * bump]
  })

export const HEART: Point[] = [[0, 0.95], [-0.95, 0.05], [-0.95, -0.5], [-0.5, -0.9], [0, -0.5], [0.5, -0.9], [0.95, -0.5], [0.95, 0.05]]

export const tracePath = (context: CanvasRenderingContext2D, points: Point[], smooth: boolean, closed: boolean): void => {
  context.beginPath()
  const middle = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  if (smooth && points.length > 2 && closed) {
    const start = middle(points[points.length - 1], points[0])
    context.moveTo(start[0], start[1])
    points.forEach((point, index) => {
      const next = middle(point, points[(index + 1) % points.length])
      context.quadraticCurveTo(point[0], point[1], next[0], next[1])
    })
    context.closePath()
    return
  }
  if (smooth && points.length > 2) {
    context.moveTo(points[0][0], points[0][1])
    for (let index = 1; index < points.length - 1; index++) {
      const next = middle(points[index], points[index + 1])
      context.quadraticCurveTo(points[index][0], points[index][1], next[0], next[1])
    }
    const last = points[points.length - 1]
    context.lineTo(last[0], last[1])
    return
  }
  points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)))
  if (closed) {
    context.closePath()
  }
}

const wobbled = (part: ClayPart, points: Point[], time: number, radius: number, seed: number): Point[] =>
  points.map(([x, y], index) =>
    part.sharp ? [x * radius, y * radius] : [(x + Math.sin(time * 3 + index * 1.7 + seed) * WOBBLE) * radius, (y + Math.cos(time * 2.6 + index * 1.3 + seed) * WOBBLE) * radius],
  )

export const drawClayParts = (context: CanvasRenderingContext2D, parts: ClayPart[], time: number, radius: number, drawEyes?: () => void): void => {
  const line = clayLine(radius)
  context.lineJoin = 'round'
  context.lineCap = 'round'
  parts.forEach((part, seed) => {
    if (part.eyes) {
      drawEyes?.()
      return
    }
    const source = part.points ?? part.stroke ?? []
    const points = wobbled(part, source, time, radius, seed)
    context.save()
    context.globalAlpha *= part.alpha ?? 1
    if (part.points) {
      tracePath(context, points, !part.sharp, true)
      context.fillStyle = part.fill ?? INK
      context.fill()
      if (!part.noLine) {
        context.strokeStyle = INK
        context.lineWidth = line * (part.lineScale ?? 1)
        context.stroke()
      }
    } else {
      const width = (part.width ?? 0.05) * radius
      if (!part.bare) {
        context.strokeStyle = INK
        context.lineWidth = width + line * 2 * (part.lineScale ?? 1)
        tracePath(context, points, true, Boolean(part.closed))
        context.stroke()
      }
      context.strokeStyle = part.color ?? INK
      context.lineWidth = width
      tracePath(context, points, true, Boolean(part.closed))
      context.stroke()
    }
    context.restore()
  })
}

export const drawClayShape = (context: CanvasRenderingContext2D, points: Point[], x: number, y: number, size: number, rotation: number, fill: string, alpha: number, line: number): void => {
  if (size <= 0.2 || alpha <= 0) {
    return
  }
  context.save()
  context.translate(x, y)
  context.rotate(rotation)
  context.globalAlpha *= Math.min(1, alpha)
  tracePath(
    context,
    points.map(([px, py]) => [px * size, py * size]),
    true,
    true,
  )
  context.fillStyle = fill
  context.fill()
  if (line > 0) {
    context.strokeStyle = INK
    context.lineWidth = line
    context.lineJoin = 'round'
    context.stroke()
  }
  context.restore()
}

export const hashUnit = (a: number, b: number, c: number): number => {
  const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453
  return value - Math.floor(value)
}

export const smoothstep = (progress: number): number => progress * progress * (3 - 2 * progress)

export const easeInOutCubic = (progress: number): number => (progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2)
