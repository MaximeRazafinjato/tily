import type { ITheme } from '@xterm/xterm'
import { bridge } from '../bridge/bridge'
import type { AmbianceGradient, AmbiancePreset, AmbianceSettings, TerminalTheme } from '../bridge/appearanceMessages'
import { useAppearanceStore } from '../store/appearanceStore'
import { terminalRegistry } from '../terminal/terminalRegistry'
import { startAccentAnimation } from './accentAnimation'

const AMBIANCE_ATTRIBUTE = 'data-ambiance'
const TERMINAL_ATTRIBUTE = 'data-ambiance-terminal'
const VEIL_PROPERTY = '--tily-ambiance-veil'
const SELECTION_ALPHA = 40
const MEDIA_HOST = 'https://tily.ambiance/'
const VIDEO_EXTENSIONS = ['.mp4', '.webm']

export const AMBIANCE_MEDIA_PICK_FIELD = 'ambianceMediaPick'
export const AMBIANCE_MEDIA_FIELD = 'ambianceMedia'

export const mediaUrlOf = (name: string): string => `${MEDIA_HOST}${encodeURIComponent(name)}`

export const isVideo = (name: string): boolean => VIDEO_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension))

export const importAmbianceMedia = (path: string): void => bridge.send({ type: 'appearance.importMedia', path })

export const ambianceBackgroundShown = (ambiance: AmbianceSettings): boolean => ambiance.enabled && ambiance.background.enabled

export const ambianceTerminalShown = (ambiance: AmbianceSettings): boolean => ambiance.enabled && ambiance.terminal.enabled

export const withAlpha = (color: string, percent: number): string =>
  /^#[0-9a-f]{6}$/i.test(color) ? `${color}${Math.round((percent / 100) * 255).toString(16).padStart(2, '0')}` : color

export const terminalThemeOf = (base: TerminalTheme, ambiance: AmbianceSettings | null): ITheme => {
  if (!ambiance || !ambianceTerminalShown(ambiance)) {
    return base
  }
  const { colors } = ambiance.gradient
  return {
    ...base,
    background: withAlpha(base.background, ambiance.terminal.veil),
    ...(ambiance.terminal.presetColors && { cursor: colors[0], cursorAccent: base.background, selectionBackground: withAlpha(colors[1], SELECTION_ALPHA) }),
  }
}

const applyToDocument = (ambiance: AmbianceSettings | null): void => {
  const root = document.documentElement
  const background = ambiance !== null && ambianceBackgroundShown(ambiance)
  root.toggleAttribute(AMBIANCE_ATTRIBUTE, background)
  root.toggleAttribute(TERMINAL_ATTRIBUTE, ambiance !== null && ambianceTerminalShown(ambiance))
  if (background) {
    root.style.setProperty(VEIL_PROPERTY, `${ambiance.interfaceVeil}%`)
  } else {
    root.style.removeProperty(VEIL_PROPERTY)
  }
}

export const startAmbiance = (): (() => void) => {
  let applied: AmbianceSettings | null | undefined
  let appliedBase: TerminalTheme | undefined
  let stopAccent: (() => void) | null = null
  const apply = () => {
    const { ambiance, state } = useAppearanceStore.getState()
    const base = state?.theme.terminal
    if (ambiance === applied && base === appliedBase) {
      return
    }
    applied = ambiance
    appliedBase = base
    applyToDocument(ambiance)
    if (base) {
      terminalRegistry.setTheme(terminalThemeOf(base, ambiance))
    }
    terminalRegistry.setFontFamily(ambiance && ambianceTerminalShown(ambiance) ? ambiance.terminal.fontFamily : undefined)
    stopAccent?.()
    stopAccent = ambiance?.enabled && ambiance.animatedAccent ? startAccentAnimation(ambiance) : null
  }
  apply()
  const unsubscribe = useAppearanceStore.subscribe(apply)
  return () => {
    unsubscribe()
    stopAccent?.()
    applyToDocument(null)
  }
}

export const receiveAmbiance = (ambiance: AmbianceSettings): void => useAppearanceStore.getState().setAmbiance(ambiance)

export const toggleAmbiance = (): void => {
  const ambiance = useAppearanceStore.getState().ambiance
  if (ambiance) {
    bridge.send({ type: 'appearance.ambianceEnabled', enabled: !ambiance.enabled })
  }
}

export const allAmbiancePresets = (ambiance: AmbianceSettings): AmbiancePreset[] => [...useAppearanceStore.getState().ambiancePresets, ...ambiance.presets]

const sameGradient = (first: AmbianceGradient, second: AmbianceGradient): boolean => JSON.stringify(first) === JSON.stringify(second)

export const matchingPreset = (ambiance: AmbianceSettings): AmbiancePreset | undefined => allAmbiancePresets(ambiance).find((preset) => sameGradient(preset.gradient, ambiance.gradient))

export const isBuiltInPreset = (name: string): boolean => useAppearanceStore.getState().ambiancePresets.some((preset) => preset.name.toLowerCase() === name.toLowerCase())

export const cyclePreset = (ambiance: AmbianceSettings, step: number): AmbianceGradient => {
  const presets = allAmbiancePresets(ambiance)
  const current = presets.findIndex((preset) => sameGradient(preset.gradient, ambiance.gradient))
  const next = current < 0 ? (step > 0 ? 0 : presets.length - 1) : (current + step + presets.length) % presets.length
  return presets[next].gradient
}

export const withSavedPreset = (ambiance: AmbianceSettings, name: string): AmbiancePreset[] => [
  ...ambiance.presets.filter((preset) => preset.name.toLowerCase() !== name.toLowerCase()),
  { name, gradient: ambiance.gradient },
]

export const withoutPreset = (ambiance: AmbianceSettings, name: string): AmbiancePreset[] => ambiance.presets.filter((preset) => preset.name !== name)
