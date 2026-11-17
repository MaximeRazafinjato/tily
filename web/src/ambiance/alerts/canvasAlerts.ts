import { ALERT_MS, animateCanvas, easeOut, pick, randomBetween, shadesOf, spawnOverlay } from './alertKit'

const CONFETTI_MS = 2600
const CONFETTI_PIECES = 160
const FIREWORKS_MS = 2600
const ROCKETS = 5
const SPARKS_PER_ROCKET = 70
const MATRIX_MS = 2400
const MATRIX_GLYPHS = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>/{}=*+'
const MATRIX_SIZE = 16
const WARP_STARS = 260
const FRAME_MS = 16.67

interface ConfettiPiece {
  x: number
  y: number
  vx: number
  vy: number
  width: number
  height: number
  angle: number
  spin: number
  fill: string
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  decay: number
  fill: string
}

export const playConfetti = (color: string): void => {
  const canvas = spawnOverlay('canvas', { position: 'absolute', inset: '0' })
  canvas.width = innerWidth
  canvas.height = innerHeight
  const context = canvas.getContext('2d')
  if (!context) {
    canvas.remove()
    return
  }
  const shades = shadesOf(color)
  const power = Math.sqrt(innerHeight) * 0.75
  const pieces: ConfettiPiece[] = Array.from({ length: CONFETTI_PIECES }, (_, index) => {
    const fromLeft = index % 2 === 0
    return {
      x: fromLeft ? 0 : innerWidth,
      y: innerHeight,
      vx: (fromLeft ? 1 : -1) * randomBetween(0.25, 0.75) * power,
      vy: -randomBetween(0.7, 1.15) * power,
      width: randomBetween(6, 11),
      height: randomBetween(3, 6),
      angle: randomBetween(0, Math.PI),
      spin: randomBetween(-0.3, 0.3),
      fill: shades[index % shades.length],
    }
  })
  const start = performance.now()
  let previous = start
  const frame = (now: number) => {
    const elapsed = now - start
    if (elapsed >= CONFETTI_MS) {
      canvas.remove()
      return
    }
    const step = (now - previous) / FRAME_MS
    previous = now
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.globalAlpha = 1 - easeOut(Math.max(0, 1 - (CONFETTI_MS - elapsed) / (CONFETTI_MS * 0.3)))
    pieces.forEach((piece) => {
      piece.vy += 0.35 * step
      piece.vx *= 0.99 ** step
      piece.x += piece.vx * step
      piece.y += piece.vy * step
      piece.angle += piece.spin * step
      context.save()
      context.translate(piece.x, piece.y)
      context.rotate(piece.angle)
      context.fillStyle = piece.fill
      context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height)
      context.restore()
    })
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

export const playFireworks = (color: string): void =>
  animateCanvas(FIREWORKS_MS, (context, width, height) => {
    const shades = shadesOf(color)
    const gravity = 0.25
    const rockets = Array.from({ length: ROCKETS }, (_, index) => ({
      x: width * randomBetween(0.15, 0.85),
      y: height,
      vy: -Math.sqrt(2 * gravity * height * randomBetween(0.45, 0.75)),
      delay: index * 0.08,
      exploded: false,
      fill: shades[index % shades.length],
    }))
    let sparks: Spark[] = []
    context.globalCompositeOperation = 'lighter'
    context.lineCap = 'round'
    return (progress, step, fade) => {
      context.clearRect(0, 0, width, height)
      rockets.forEach((rocket) => {
        if (rocket.exploded || progress < rocket.delay) {
          return
        }
        rocket.y += rocket.vy * step
        rocket.vy += gravity * step
        if (rocket.vy >= -2) {
          rocket.exploded = true
          sparks.push(
            ...Array.from({ length: SPARKS_PER_ROCKET }, () => {
              const angle = randomBetween(0, Math.PI * 2)
              const speed = randomBetween(1, 7)
              return { x: rocket.x, y: rocket.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, decay: randomBetween(0.012, 0.025), fill: pick(shades) }
            }),
          )
          return
        }
        context.globalAlpha = fade
        context.strokeStyle = rocket.fill
        context.lineWidth = 3
        context.beginPath()
        context.moveTo(rocket.x, rocket.y)
        context.lineTo(rocket.x, rocket.y - rocket.vy * 3)
        context.stroke()
      })
      sparks = sparks.filter((spark) => spark.life > 0)
      context.lineWidth = 2
      sparks.forEach((spark) => {
        spark.vx *= 0.97 ** step
        spark.vy = spark.vy * 0.97 ** step + 0.06 * step
        spark.x += spark.vx * step
        spark.y += spark.vy * step
        spark.life -= spark.decay * step
        context.globalAlpha = Math.max(0, spark.life) * fade
        context.strokeStyle = spark.fill
        context.beginPath()
        context.moveTo(spark.x - spark.vx * 3, spark.y - spark.vy * 3)
        context.lineTo(spark.x, spark.y)
        context.stroke()
      })
    }
  })

export const playMatrix = (color: string): void =>
  animateCanvas(MATRIX_MS, (context, width, height) => {
    const drops = Array.from({ length: Math.ceil(width / MATRIX_SIZE) }, (_, column) => ({
      x: column * MATRIX_SIZE,
      y: -randomBetween(0, height),
      speed: randomBetween(8, 18),
      chars: Array.from({ length: Math.floor(randomBetween(8, 24)) }, () => pick(MATRIX_GLYPHS)),
    }))
    context.font = `${MATRIX_SIZE}px Consolas, monospace`
    return (_progress, step, fade) => {
      context.clearRect(0, 0, width, height)
      drops.forEach((drop) => {
        drop.y += drop.speed * step
        if (Math.random() < 0.1) {
          drop.chars[Math.floor(Math.random() * drop.chars.length)] = pick(MATRIX_GLYPHS)
        }
        drop.chars.forEach((char, index) => {
          context.globalAlpha = fade * (1 - index / drop.chars.length)
          context.fillStyle = index === 0 ? '#fff' : color
          context.fillText(char, drop.x, drop.y - index * MATRIX_SIZE)
        })
      })
    }
  })

export const playWarp = (color: string): void =>
  animateCanvas(ALERT_MS, (context, width, height) => {
    const shades = shadesOf(color)
    const centerX = width / 2
    const centerY = height / 2
    const reach = Math.hypot(centerX, centerY)
    const stars = Array.from({ length: WARP_STARS }, () => ({ angle: randomBetween(0, Math.PI * 2), distance: randomBetween(0, 80), speed: randomBetween(0.02, 0.06), fill: pick(shades) }))
    context.globalCompositeOperation = 'lighter'
    context.lineCap = 'round'
    return (progress, step, fade) => {
      context.clearRect(0, 0, width, height)
      const boost = 1 + easeOut(progress) * 6
      stars.forEach((star) => {
        const previous = star.distance
        star.distance += (star.distance * star.speed * boost + 0.5) * step
        if (star.distance > reach) {
          star.distance = randomBetween(0, 40)
          return
        }
        const cos = Math.cos(star.angle)
        const sin = Math.sin(star.angle)
        context.globalAlpha = fade * Math.min(1, star.distance / 200)
        context.strokeStyle = star.fill
        context.lineWidth = 1 + star.distance / 400
        context.beginPath()
        context.moveTo(centerX + cos * previous, centerY + sin * previous)
        context.lineTo(centerX + cos * star.distance, centerY + sin * star.distance)
        context.stroke()
      })
    }
  })
