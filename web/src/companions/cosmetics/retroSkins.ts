import { CompanionSkin } from './cosmeticCatalog'
import { clayLine, hashUnit, INK, roundedBox, TAU, tracePath } from './clayShapes'
import { fillBody, insideBody, radialFill, strokeBody, type SkinStyle } from './skinPaint'

const SYNTH_NIGHT = '#1a0b2e'
const SYNTH_GRID = '#ff4fd8'
const HOLO = '#5ff3ff'

const synthwave: SkinStyle = {
  paint: (context, { points, radius, time, line }) => {
    const sky = context.createLinearGradient(0, -radius, 0, radius * 0.15)
    sky.addColorStop(0, '#ffe066')
    sky.addColorStop(0.55, '#ff6ec7')
    sky.addColorStop(1, '#9b3bd8')
    fillBody(context, points, sky)
    insideBody(context, points, () => {
      context.fillStyle = SYNTH_NIGHT
      for (let band = 0; band < 5; band++) {
        const height = radius * (0.075 - band * 0.012)
        if (height > 0) {
          context.fillRect(-radius * 2, (-0.02 - band * 0.13 + ((time * 0.15) % 0.13)) * radius, radius * 4, height)
        }
      }
      context.fillRect(-radius * 2, radius * 0.12, radius * 4, radius * 2)
      context.shadowColor = SYNTH_GRID
      context.shadowBlur = radius * 0.2
      context.strokeStyle = SYNTH_GRID
      context.lineWidth = Math.max(1, radius * 0.025)
      for (let row = 0; row < 6; row++) {
        const depth = (row + ((time * 0.8) % 1)) / 6
        const y = radius * (0.12 + depth * depth * 0.95)
        context.beginPath()
        context.moveTo(-radius * 1.5, y)
        context.lineTo(radius * 1.5, y)
        context.stroke()
      }
      for (let column = -6; column <= 6; column++) {
        context.beginPath()
        context.moveTo(column * radius * 0.05, radius * 0.12)
        context.lineTo(column * radius * 0.32, radius * 1.1)
        context.stroke()
      }
    })
    strokeBody(context, points, INK, line)
  },
}

const RIVETS: [number, number][] = [[-0.75, 0.42], [-0.2, 0.42], [0.3, 0.42], [0.75, 0.42], [-0.6, -0.55], [0.6, -0.55]]

const mecha: SkinStyle = {
  back: (context, { radius, time }) => {
    const lit = Math.floor(time * 2) % 2 === 1
    context.lineCap = 'round'
    context.strokeStyle = INK
    context.lineWidth = clayLine(radius) * 1.6
    context.beginPath()
    context.moveTo(radius * 0.35, -radius * 0.8)
    context.lineTo(radius * 0.55, -radius * 1.4)
    context.stroke()
    context.strokeStyle = '#c9cdd8'
    context.lineWidth = clayLine(radius) * 0.7
    context.stroke()
    if (lit) {
      context.shadowColor = '#ff3b4a'
      context.shadowBlur = radius * 0.4
    }
    context.fillStyle = lit ? '#ff3b4a' : '#7a2a30'
    context.strokeStyle = INK
    context.lineWidth = clayLine(radius) * 0.5
    context.beginPath()
    context.arc(radius * 0.55, -radius * 1.42, radius * 0.09, 0, TAU)
    context.fill()
    context.stroke()
  },
  paint: (context, { points, radius, time, hue, line }) => {
    fillBody(context, points, '#9aa3b5')
    insideBody(context, points, () => {
      context.fillStyle = '#7f889a'
      context.fillRect(-radius * 2, radius * 0.3, radius * 4, radius * 2)
      context.save()
      context.rotate(-0.6)
      context.fillStyle = 'rgba(255, 255, 255, 0.28)'
      context.fillRect(-radius * 0.9, -radius * 1.2, radius * 0.22, radius * 2.4)
      context.restore()
      context.strokeStyle = 'rgba(26, 21, 48, 0.5)'
      context.lineWidth = clayLine(radius) * 0.4
      context.beginPath()
      context.moveTo(-radius, radius * 0.3)
      context.lineTo(radius, radius * 0.3)
      context.moveTo(-radius * 0.45, -radius)
      context.lineTo(-radius * 0.45, -radius * 0.38)
      context.moveTo(radius * 0.45, radius * 0.3)
      context.lineTo(radius * 0.45, radius)
      context.stroke()
      context.fillStyle = '#5d6576'
      RIVETS.forEach(([x, y]) => {
        context.beginPath()
        context.arc(x * radius, y * radius, radius * 0.035, 0, TAU)
        context.fill()
      })
      context.shadowColor = `hsl(${hue}, 100%, 60%)`
      context.shadowBlur = radius * 0.3
      context.fillStyle = Math.sin(time * 3) > 0 ? `hsl(${hue}, 100%, 62%)` : `hsl(${hue}, 50%, 30%)`
      context.beginPath()
      context.arc(radius * 0.62, radius * 0.6, radius * 0.07, 0, TAU)
      context.fill()
    })
    strokeBody(context, points, INK, line)
  },
  eyes: (context, { radius, time, hue }, { blink }) => {
    tracePath(
      context,
      roundedBox(-0.64, -0.32, 0.64, 0.06, 0.12).map(([x, y]) => [x * radius, y * radius]),
      true,
      true,
    )
    context.fillStyle = '#151a24'
    context.fill()
    context.strokeStyle = INK
    context.lineWidth = clayLine(radius) * 0.6
    context.stroke()
    context.clip()
    const glow = `hsl(${hue}, 100%, 62%)`
    context.shadowColor = glow
    context.shadowBlur = radius * 0.35
    context.fillStyle = glow
    ;[-1, 1].forEach((side) => {
      context.beginPath()
      context.ellipse(side * radius * 0.3, -radius * 0.13, radius * 0.13, radius * 0.05 * (1 - blink) + 0.5, 0, 0, TAU)
      context.fill()
    })
    context.fillStyle = `hsla(${hue}, 100%, 80%, 0.35)`
    context.fillRect((((time * 0.8) % 1) * 1.6 - 0.8) * radius - radius * 0.06, -radius * 0.35, radius * 0.12, radius * 0.45)
  },
}

const hologram: SkinStyle = {
  back: (context, { radius, line }) => {
    context.fillStyle = radialFill(context, 0, radius * 0.1, 0, radius * 1.3, [[0, 'rgba(95, 243, 255, 0.14)'], [1, 'rgba(95, 243, 255, 0)']])
    context.beginPath()
    context.moveTo(-radius * 0.7, radius * 0.98)
    context.lineTo(radius * 0.7, radius * 0.98)
    context.lineTo(radius * 1.15, -radius * 1.15)
    context.lineTo(-radius * 1.15, -radius * 1.15)
    context.closePath()
    context.fill()
    context.fillStyle = '#2a3036'
    context.strokeStyle = INK
    context.lineWidth = line * 0.6
    context.beginPath()
    context.ellipse(0, radius * 1.02, radius * 0.72, radius * 0.13, 0, 0, TAU)
    context.fill()
    context.stroke()
    context.shadowColor = HOLO
    context.shadowBlur = radius * 0.3
    context.strokeStyle = HOLO
    context.lineWidth = line * 0.5
    context.beginPath()
    context.ellipse(0, radius * 0.99, radius * 0.5, radius * 0.07, 0, 0, TAU)
    context.stroke()
  },
  paint: (context, { points, radius, time, line }) => {
    const frame = Math.floor(time * 14)
    context.save()
    context.globalAlpha *= hashUnit(frame, 5, 1) > 0.92 ? 0.45 : 1
    if (hashUnit(frame, 6, 1) > 0.95) {
      context.translate((hashUnit(Math.floor(time * 30), 1, 1) - 0.5) * radius * 0.15, 0)
    }
    fillBody(context, points, 'rgba(95, 243, 255, 0.22)')
    insideBody(context, points, () => {
      const step = Math.max(2.5, radius * 0.075)
      context.fillStyle = 'rgba(170, 250, 255, 0.35)'
      for (let y = -radius * 1.2 + ((time * radius * 0.4) % step); y < radius * 1.2; y += step) {
        context.fillRect(-radius * 1.5, y, radius * 3, Math.max(1, radius * 0.022))
      }
      context.fillStyle = 'rgba(210, 255, 255, 0.22)'
      context.fillRect(-radius * 1.5, (((time * 0.5) % 1) * 2.4 - 1.2) * radius, radius * 3, radius * 0.16)
    })
    context.shadowColor = HOLO
    context.shadowBlur = radius * 0.4
    strokeBody(context, points, 'rgba(150, 250, 255, 0.9)', line * 0.8)
    context.restore()
  },
  eyeColor: () => '#bdfcff',
  glow: true,
}

export const RETRO_SKINS: Partial<Record<CompanionSkin, SkinStyle>> = {
  [CompanionSkin.Synthwave]: synthwave,
  [CompanionSkin.Mecha]: mecha,
  [CompanionSkin.Hologram]: hologram,
}
