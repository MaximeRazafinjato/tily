import { fitCanvas, shouldRender, speedOf, type AmbianceReader } from './renderPacing'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  index: number
}

const AREA_PER_PARTICLE = 14000
const MAX_STEP = 4
const FRAME_MS = 16.67
const LINK_ALPHA = 0.6
const GLOW = 10

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min)

const createParticles = (width: number, height: number): Particle[] =>
  Array.from({ length: Math.round((width * height) / AREA_PER_PARTICLE) }, (_, index) => ({
    x: randomBetween(0, width),
    y: randomBetween(0, height),
    vx: randomBetween(-1, 1),
    vy: randomBetween(-1, 1),
    radius: randomBetween(1, 2.8),
    index,
  }))

const drawLinks = (context: CanvasRenderingContext2D, particles: Particle[], colors: string[], linkDistance: number): void => {
  context.lineWidth = 1
  particles.forEach((from, fromIndex) => {
    for (let toIndex = fromIndex + 1; toIndex < particles.length; toIndex++) {
      const to = particles[toIndex]
      const distance = Math.hypot(from.x - to.x, from.y - to.y)
      if (distance < linkDistance) {
        context.globalAlpha = (1 - distance / linkDistance) * LINK_ALPHA
        context.strokeStyle = colors[from.index % colors.length]
        context.beginPath()
        context.moveTo(from.x, from.y)
        context.lineTo(to.x, to.y)
        context.stroke()
      }
    }
  })
  context.globalAlpha = 1
}

const drawDots = (context: CanvasRenderingContext2D, particles: Particle[], colors: string[]): void => {
  context.shadowBlur = GLOW
  particles.forEach((particle) => {
    const color = colors[particle.index % colors.length]
    context.fillStyle = color
    context.shadowColor = color
    context.beginPath()
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
    context.fill()
  })
  context.shadowBlur = 0
}

export const startParticles = (canvas: HTMLCanvasElement, read: AmbianceReader): (() => void) => {
  const context = canvas.getContext('2d')
  if (!context) {
    return () => undefined
  }
  fitCanvas(canvas, 1)
  const particles = createParticles(canvas.width, canvas.height)
  let previous = performance.now()
  let frame = 0
  const draw = (now: number) => {
    frame = requestAnimationFrame(draw)
    const { gradient, performance: pacing } = read()
    if (!shouldRender(pacing, now, previous)) {
      return
    }
    const step = Math.min(MAX_STEP, (now - previous) / FRAME_MS)
    previous = now
    fitCanvas(canvas, 1)
    const { width, height } = canvas
    const speed = Math.abs(speedOf(gradient)) * step
    context.clearRect(0, 0, width, height)
    particles.forEach((particle) => {
      particle.x = (particle.x + particle.vx * speed + width) % width
      particle.y = (particle.y + particle.vy * speed + height) % height
    })
    drawLinks(context, particles, gradient.colors, gradient.band / 10)
    drawDots(context, particles, gradient.colors)
  }
  frame = requestAnimationFrame(draw)
  return () => cancelAnimationFrame(frame)
}
