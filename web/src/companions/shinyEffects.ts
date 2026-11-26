import { createBlob, lerp, ParticleKind, pick, randomBetween, SHAPE_ORDER, type Blob, type Particle, type World } from './blobModel'

const SHINY_HUE_SHIFT = 150
const GOLD_HUE = 48
const TWINKLE_LIFETIME_S = 0.7
const TWINKLE_DRAG = 1.5
const SHIMMER_PERIOD_S = 3.2
const SHIMMER_SWEEP_S = 0.9
const SHIMMER_ANGLE = -0.45
const NOVA_LIFETIME_S = 1.4
const NOVA_REACH = 11
const CORE_STAR_SCALE = 4
const CORE_STAR_LIFETIME_S = 1.1
const BURST_SPARKS = 90
const DEMO_LIFETIME_S = 20
const DEMO_NAME = 'Démonstration'

type Range = [number, number]

interface TwinkleWave {
  count: number
  speed: Range
  size: Range
  lifetime: Range
}

const BURST_WAVES: TwinkleWave[] = [
  { count: 64, speed: [600, 1100], size: [0.4, 0.75], lifetime: [1.4, 2] },
  { count: 44, speed: [300, 560], size: [0.45, 0.8], lifetime: [1.6, 2.3] },
  { count: 26, speed: [90, 220], size: [0.7, 1.1], lifetime: [1.8, 2.6] },
]

const between = ([min, max]: Range): number => randomBetween(min, max)

export const hueOf = (blob: Blob): number => (blob.shiny ? (blob.hue + SHINY_HUE_SHIFT) % 360 : blob.hue)

const addTwinkle = (world: World, x: number, y: number, vx: number, vy: number, size: number, lifetime = TWINKLE_LIFETIME_S): void => {
  world.particles.push({ kind: ParticleKind.Twinkle, x, y, vx, vy, life: 1, hue: GOLD_HUE + randomBetween(-14, 14), size, lifetime })
}

const explode = (world: World, blob: Blob): void => {
  const x = blob.x
  const y = blob.y - blob.radius
  const power = Math.sqrt(blob.radius / world.size)
  world.particles.push({ kind: ParticleKind.Nova, x, y, vx: 0, vy: 0, life: 1, hue: GOLD_HUE, size: blob.radius * NOVA_REACH, lifetime: NOVA_LIFETIME_S })
  addTwinkle(world, x, y, 0, 0, blob.radius * CORE_STAR_SCALE, CORE_STAR_LIFETIME_S)
  BURST_WAVES.forEach((wave) => {
    for (let index = 0; index < wave.count; index++) {
      const angle = (index / wave.count) * Math.PI * 2 + randomBetween(-0.15, 0.15)
      const speed = between(wave.speed) * power
      addTwinkle(world, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, blob.radius * between(wave.size), between(wave.lifetime))
    }
  })
  for (let index = 0; index < BURST_SPARKS; index++) {
    const angle = randomBetween(0, Math.PI * 2)
    const speed = randomBetween(350, 1000) * power
    world.particles.push({ kind: ParticleKind.Spark, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, hue: GOLD_HUE + randomBetween(-15, 15), size: randomBetween(2, 5), lifetime: 1.4 })
  }
}

export const setShiny = (world: World, blob: Blob, shiny: boolean): void => {
  if (shiny && !blob.shiny && !blob.stored) {
    explode(world, blob)
  }
  blob.shiny = shiny
}

export const updateShiny = (world: World, blob: Blob, dt: number): void => {
  if (blob.demo > 0) {
    blob.demo = Math.max(0, blob.demo - dt)
    blob.leaving ||= blob.demo === 0
  }
  if (!blob.shiny || blob.stored || blob.leaving || blob.grow < 1) {
    return
  }
  blob.twinkle -= dt
  if (blob.twinkle > 0) {
    return
  }
  blob.twinkle = randomBetween(0.35, 0.9)
  const angle = randomBetween(0, Math.PI * 2)
  const distance = blob.radius * randomBetween(0.7, 1.25)
  addTwinkle(world, blob.x + Math.cos(angle) * distance, blob.y - blob.radius + Math.sin(angle) * distance, 0, -12, blob.radius * randomBetween(0.18, 0.3))
}

export const slowTwinkle = (particle: Particle, dt: number): void => {
  if (particle.kind !== ParticleKind.Twinkle) {
    return
  }
  const kept = Math.max(0, 1 - dt * TWINKLE_DRAG)
  particle.vx *= kept
  particle.vy *= kept
}

export const spawnShinyDemo = (world: World): void => {
  const blob = createBlob(world, `shiny-demo-${world.clock}`, '', Math.floor(randomBetween(0, 360)), null)
  blob.name = DEMO_NAME
  blob.shape = pick(SHAPE_ORDER)
  blob.demo = DEMO_LIFETIME_S
  world.blobs.push(blob)
  setShiny(world, blob, true)
}

export const drawShimmer = (context: CanvasRenderingContext2D, blob: Blob, radius: number): void => {
  const phase = (blob.clock % SHIMMER_PERIOD_S) / SHIMMER_SWEEP_S
  if (!blob.shiny || phase >= 1) {
    return
  }
  const x = lerp(-radius * 1.8, radius * 1.8, phase)
  const band = radius * 0.45
  context.save()
  context.clip()
  context.rotate(SHIMMER_ANGLE)
  const gradient = context.createLinearGradient(x - band, 0, x + band, 0)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = gradient
  context.fillRect(x - band, -radius * 2, band * 2, radius * 4)
  context.restore()
}

const drawTwinkle = (context: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  if (size <= 0.3) {
    return
  }
  context.beginPath()
  context.moveTo(x, y - size)
  context.quadraticCurveTo(x, y, x + size, y)
  context.quadraticCurveTo(x, y, x, y + size)
  context.quadraticCurveTo(x, y, x - size, y)
  context.quadraticCurveTo(x, y, x, y - size)
  context.fill()
}

const drawNova = (context: CanvasRenderingContext2D, particle: Particle): void => {
  const { x, y, hue, life } = particle
  const radius = particle.size * (1 - life ** 3)
  if (radius <= 1) {
    return
  }
  const glow = context.createRadialGradient(x, y, 0, x, y, radius)
  glow.addColorStop(0, `hsla(${hue}, 100%, 92%, 0.8)`)
  glow.addColorStop(0.45, `hsla(${hue}, 100%, 70%, 0.35)`)
  glow.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`)
  context.fillStyle = glow
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = `hsl(${hue}, 100%, 85%)`
  context.lineWidth = 2 + 6 * life
  context.stroke()
}

export const drawShinyParticle = (context: CanvasRenderingContext2D, particle: Particle): void => {
  context.globalCompositeOperation = 'lighter'
  if (particle.kind === ParticleKind.Nova) {
    drawNova(context, particle)
  } else {
    context.fillStyle = `hsl(${particle.hue}, 100%, 82%)`
    drawTwinkle(context, particle.x, particle.y, particle.size * Math.min(1, (1 - particle.life) * 6, particle.life * 1.6))
  }
  context.globalCompositeOperation = 'source-over'
}
