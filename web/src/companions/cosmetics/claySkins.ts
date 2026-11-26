import { CompanionSkin } from './cosmeticCatalog'
import { clayLine, drawClayShape, hashUnit, INK, star, TAU, type Point } from './clayShapes'
import { fillBody, insideBody, plainPaint, strokeBody, type FaceState, type SkinPainting, type SkinStyle } from './skinPaint'

const RAINBOW = ['#f07a70', '#ffb05a', '#ffd84a', '#7ad97a', '#5ab4ff', '#a98fc9']
const SCARED_PERIOD_S = 9
const SCARED_FROM_S = 6.5
const SCARED_FLASH_S = 8.2

const scared = (time: number): boolean => time % SCARED_PERIOD_S > SCARED_FROM_S

const slime: SkinStyle = {
  paint: (context, { points, radius, time, hue, line }) => {
    context.beginPath()
    context.ellipse(0, radius * 0.97, radius * (1.05 + 0.04 * Math.sin(time * 2)), radius * 0.13, 0, 0, TAU)
    context.fillStyle = `hsla(${hue}, 85%, 55%, 0.5)`
    context.fill()
    fillBody(context, points, `hsla(${hue}, 85%, 62%, 0.72)`)
    insideBody(context, points, () => {
      context.fillStyle = 'rgba(255, 255, 255, 0.45)'
      for (let index = 0; index < 6; index++) {
        context.beginPath()
        context.arc((hashUnit(index, 1, 4) * 1.4 - 0.7) * radius + Math.sin(time * 2 + index) * radius * 0.05, radius * (0.85 - ((time * 0.28 + index * 0.19) % 1) * 1.75), radius * (0.05 + 0.04 * (index % 3)), 0, TAU)
        context.fill()
      }
      context.fillStyle = 'rgba(255, 255, 255, 0.7)'
      context.beginPath()
      context.ellipse(-radius * 0.48, -radius * 0.52, radius * 0.2, radius * 0.1, -0.7, 0, TAU)
      context.fill()
    })
    strokeBody(context, points, INK, line)
  },
}

const ghost: SkinStyle = {
  paint: (context, { points, line }) => {
    fillBody(context, points, 'rgba(236, 240, 255, 0.62)')
    strokeBody(context, points, 'rgba(26, 21, 48, 0.6)', line)
  },
  outline: (points, radius, time) =>
    points.map(([x, y]): Point => (y <= 0 ? [x, y] : [x, y + (radius * (0.92 + 0.13 * Math.sin((x / radius) * 9 - time * 6)) - y) * Math.min(1, y / (radius * 0.5))])),
  lift: (radius, time) => radius * (0.2 + 0.07 * Math.sin(time * 2.2)),
}

const rainbow: SkinStyle = {
  paint: (context, { points, radius, time, line }) => {
    fillBody(context, points, '#ffffff')
    insideBody(context, points, () => {
      context.rotate(-0.55)
      const width = radius * 0.3
      const offset = (time * radius * 0.6) % (width * RAINBOW.length)
      for (let index = -12; index < 12; index++) {
        context.fillStyle = RAINBOW[((index % RAINBOW.length) + RAINBOW.length) % RAINBOW.length]
        context.fillRect(index * width + offset, -radius * 2, width + 1, radius * 4)
      }
    })
    strokeBody(context, points, INK, line)
  },
}

const galaxy: SkinStyle = {
  paint: (context, { points, radius, time, hue, line }) => {
    fillBody(context, points, `hsl(${hue}, 45%, 20%)`)
    insideBody(context, points, () => {
      const nebulae: [string, number][] = [[`hsla(${hue + 50}, 90%, 65%, 0.3)`, 0.5], ['rgba(255, 122, 200, 0.26)', 0.42], [`hsla(${hue - 40}, 90%, 60%, 0.24)`, 0.55]]
      nebulae.forEach(([color, size], index) => {
        context.fillStyle = color
        context.beginPath()
        context.arc(Math.cos(time * 0.3 + index * 2.1) * radius * 0.4, Math.sin(time * 0.25 + index * 2.1) * radius * 0.35, radius * size, 0, TAU)
        context.fill()
      })
      for (let index = 0; index < 16; index++) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * 3 + index * 1.7)
        drawClayShape(context, star(0, 0, 1, 0.3), (hashUnit(index, 1, 0) * 2 - 1) * radius * 0.9, (hashUnit(index, 2, 0) * 2 - 1) * radius * 0.9, radius * (0.04 + 0.07 * twinkle * hashUnit(index, 3, 0)), 0, '#ffffff', 0.5 + 0.5 * twinkle, 0)
      }
    })
    strokeBody(context, points, INK, line)
  },
  eyeColor: () => '#ffffff',
}

const neon: SkinStyle = {
  paint: (context, { points, radius, time, hue, line }) => {
    const flicker = hashUnit(Math.floor(time * 12), 3, hue) > 0.96 ? 0.45 : 1
    fillBody(context, points, '#0e1115')
    context.save()
    context.globalAlpha *= flicker
    context.shadowColor = `hsl(${hue}, 100%, 60%)`
    context.shadowBlur = radius * 0.5
    strokeBody(context, points, `hsl(${hue}, 100%, 62%)`, line * 0.9)
    context.restore()
    context.save()
    context.globalAlpha *= flicker * 0.8
    strokeBody(context, points, '#ffffff', line * 0.28)
    context.restore()
  },
  eyeColor: (hue) => `hsl(${hue}, 100%, 72%)`,
  glow: true,
}

const rpgDrop: SkinStyle = {
  paint: (context, { points, radius, hue, line }) => {
    fillBody(context, points, `hsl(${hue}, 85%, 62%)`)
    insideBody(context, points, () => {
      context.fillStyle = `hsla(${hue}, 90%, 35%, 0.25)`
      context.beginPath()
      context.ellipse(0, radius * 0.9, radius * 1.1, radius * 0.35, 0, 0, TAU)
      context.fill()
      context.fillStyle = 'rgba(255, 255, 255, 0.8)'
      context.beginPath()
      context.ellipse(-radius * 0.42, -radius * 0.38, radius * 0.2, radius * 0.12, -0.8, 0, TAU)
      context.fill()
      context.beginPath()
      context.arc(-radius * 0.18, -radius * 0.62, radius * 0.05, 0, TAU)
      context.fill()
    })
    strokeBody(context, points, INK, line)
  },
  outline: (points, radius, time) =>
    points.map(([x, y], index): Point => {
      const angle = (index / points.length) * TAU - Math.PI * 1.5
      const tip = Math.exp(-((angle / 0.33) ** 2))
      return [x + tip * radius * 0.16 * Math.sin(time * 2), y - tip * radius * 0.55]
    }),
  front: (context, { radius, time }) => {
    context.fillStyle = '#3a1020'
    context.strokeStyle = INK
    context.lineWidth = clayLine(radius) * 0.55
    context.beginPath()
    context.ellipse(0, radius * 0.24, radius * 0.34, radius * 0.2 + Math.sin(time * 3) * radius * 0.015, 0, 0, Math.PI)
    context.closePath()
    context.fill()
    context.stroke()
    context.fillStyle = '#ff7a9a'
    context.beginPath()
    context.ellipse(0, radius * 0.38, radius * 0.14, radius * 0.06, 0, Math.PI, TAU)
    context.fill()
  },
}

const arcadeEyes = (context: CanvasRenderingContext2D, { radius, time }: SkinPainting, { look }: FaceState): void => {
  if (scared(time)) {
    context.fillStyle = '#ffd7e8'
    ;[-1, 1].forEach((side) => {
      context.beginPath()
      context.arc(side * radius * 0.28, -radius * 0.22, radius * 0.08, 0, TAU)
      context.fill()
    })
    context.strokeStyle = '#ffd7e8'
    context.lineWidth = radius * 0.06
    context.lineCap = 'round'
    context.beginPath()
    for (let index = 0; index <= 8; index++) {
      const x = -radius * 0.45 + index * radius * 0.1125
      const y = radius * 0.18 + (index % 2 ? -1 : 1) * radius * 0.05
      if (index) {
        context.lineTo(x, y)
      } else {
        context.moveTo(x, y)
      }
    }
    context.stroke()
    return
  }
  ;[-1, 1].forEach((side) => {
    context.fillStyle = '#ffffff'
    context.strokeStyle = INK
    context.lineWidth = clayLine(radius) * 0.55
    context.beginPath()
    context.ellipse(side * radius * 0.3, -radius * 0.2, radius * 0.17, radius * 0.22, 0, 0, TAU)
    context.fill()
    context.stroke()
    context.fillStyle = '#2b3cff'
    context.beginPath()
    context.arc(side * radius * 0.3 + look * radius * 0.08, -radius * 0.17, radius * 0.085, 0, TAU)
    context.fill()
  })
}

const arcadeGhost: SkinStyle = {
  paint: (context, { points, time, hue, line }) => {
    const flash = scared(time) && time % SCARED_PERIOD_S > SCARED_FLASH_S && Math.floor(time * 8) % 2 === 1
    fillBody(context, points, scared(time) ? (flash ? '#f4f4ff' : '#2b3cff') : `hsl(${hue}, 90%, 58%)`)
    strokeBody(context, points, INK, line)
  },
  outline: (points, radius, time) =>
    points.map(([x, y]): Point => {
      if (y <= 0) {
        return [x, y]
      }
      const tooth = Math.abs(((((x / radius + 1) * 2 + (Math.floor(time * 5) % 2) * 0.5) % 1) * 2) - 1)
      return [x, radius * (0.74 + 0.24 * tooth)]
    }),
  eyes: arcadeEyes,
}

const GRASS = ['#5fae3a', '#4f9a2e', '#6cc046']
const DIRT = ['#8b5a2b', '#7a4e25', '#9b6a38', '#6b4220']

const voxel: SkinStyle = {
  paint: (context, { points, radius, line }) => {
    fillBody(context, points, DIRT[0])
    insideBody(context, points, () => {
      const size = radius * 0.25
      for (let column = -5; column < 5; column++) {
        for (let row = -5; row < 5; row++) {
          const grass = row * size < -radius * 0.5 + Math.floor(hashUnit(column, 7, 1) * 2) * size
          const palette = grass ? GRASS : DIRT
          context.fillStyle = palette[Math.floor(hashUnit(column, row, grass ? 2 : 3) * palette.length)]
          context.fillRect(column * size, row * size, size + 0.5, size + 0.5)
        }
      }
    })
    strokeBody(context, points, INK, line)
  },
  outline: (points, radius) =>
    points.map((_, index): Point => {
      const angle = (index / points.length) * TAU
      const reach = (radius * 0.86) / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)))
      return [Math.cos(angle) * reach, Math.sin(angle) * reach]
    }),
  eyes: (context, { radius }, { blink }) => {
    context.fillStyle = INK
    ;[-1, 1].forEach((side) => context.fillRect(side * radius * 0.3 - radius * 0.07, -radius * 0.22 + radius * 0.07 * blink, radius * 0.14, radius * 0.14 * (1 - blink) + 1))
  },
}

export const CLAY_SKINS: Partial<Record<CompanionSkin, SkinStyle>> = {
  [CompanionSkin.Pixel]: { paint: plainPaint, pixelated: true },
  [CompanionSkin.Slime]: slime,
  [CompanionSkin.Ghost]: ghost,
  [CompanionSkin.Rainbow]: rainbow,
  [CompanionSkin.Galaxy]: galaxy,
  [CompanionSkin.Neon]: neon,
  [CompanionSkin.RpgDrop]: rpgDrop,
  [CompanionSkin.ArcadeGhost]: arcadeGhost,
  [CompanionSkin.Voxel]: voxel,
}
