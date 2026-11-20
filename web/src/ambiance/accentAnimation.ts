import { AmbianceSource, type AmbianceSettings } from '../bridge/appearanceMessages'
import { useAppearanceStore } from '../store/appearanceStore'
import { hexToRgb } from './renderPacing'

const FRAME_MS = 50
const TOKEN_PREFIX = '--color-tily-'

export const colorAt = (ambiance: AmbianceSettings, time: number): string => {
  const { colors, duration, reverse } = ambiance.gradient
  if (ambiance.background.source === AmbianceSource.Solid) {
    return ambiance.background.solidColor
  }
  if (duration <= 0) {
    return colors[0]
  }
  const progress = ((time / 1000 / duration) % 1) * (reverse ? -1 : 1)
  const position = ((progress + 1) % 1) * colors.length
  const index = Math.floor(position)
  const ratio = position - index
  const from = hexToRgb(colors[index])
  const to = hexToRgb(colors[(index + 1) % colors.length])
  return `rgb(${from.map((channel, channelIndex) => Math.round(channel + (to[channelIndex] - channel) * ratio)).join(' ')})`
}

const accentTokens = (color: string): Record<string, string> => ({
  green: color,
  focus: color,
  'green-deep': `color-mix(in srgb, ${color} 75%, white)`,
  'green-soft': `color-mix(in srgb, ${color} 18%, var(--color-tily-paper))`,
  'green-hover': `color-mix(in srgb, ${color} 10%, var(--color-tily-panel))`,
})

const paint = (tokens: Record<string, string>): void => {
  const root = document.documentElement.style
  Object.entries(tokens).forEach(([token, value]) => root.setProperty(`${TOKEN_PREFIX}${token}`, value))
}

export const startAccentAnimation = (ambiance: AmbianceSettings): (() => void) => {
  const frame = () => paint(accentTokens(colorAt(ambiance, performance.now())))
  frame()
  const timer = setInterval(frame, FRAME_MS)
  return () => {
    clearInterval(timer)
    const tokens = useAppearanceStore.getState().state?.theme.tokens ?? {}
    paint(Object.fromEntries(Object.keys(accentTokens('')).map((token) => [token, tokens[token] ?? ''])))
  }
}
