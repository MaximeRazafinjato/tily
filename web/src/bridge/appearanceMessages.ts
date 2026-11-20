export interface AccentPreset {
  name: string
  color: string
}

export interface TerminalTheme {
  background: string
  foreground: string
  cursor: string
  selectionBackground: string
}

export interface AccentTheme {
  accent: string
  tokens: Record<string, string>
  terminal: TerminalTheme
}

export interface AppearanceState {
  theme: AccentTheme
  defaultColor: string
}

export interface FolderProject {
  path: string
  project?: string
  projectName?: string
  color?: string
}

export interface AppearanceCatalog {
  state: AppearanceState
  accentPresets: AccentPreset[]
  ambiancePresets: AmbiancePreset[]
}

export enum AmbianceGradientType {
  Linear = 'linear',
  Radial = 'radial',
  Plasma = 'plasma',
  Particles = 'particles',
  Aurora = 'aurora',
  Nebula = 'nebula',
  Sky = 'sky',
  Caustics = 'caustics',
}

export enum AmbianceSource {
  Gradient = 'gradient',
  Solid = 'solid',
  Media = 'media',
}

export enum AmbianceFit {
  Cover = 'cover',
  Contain = 'contain',
}

export enum AmbianceAlertEffect {
  Pulse = 'pulse',
  Wave = 'wave',
  Confetti = 'confetti',
  Flash = 'flash',
  Shake = 'shake',
  Glitch = 'glitch',
  Fireworks = 'fireworks',
  Laser = 'laser',
  Orbit = 'orbit',
  Rays = 'rays',
  Matrix = 'matrix',
  Warp = 'warp',
  Banner = 'banner',
}

export interface AmbianceGradient {
  colors: string[]
  type: AmbianceGradientType
  angle: number
  band: number
  duration: number
  reverse: boolean
}

export interface AmbiancePreset {
  name: string
  gradient: AmbianceGradient
}

export interface AmbianceBackground {
  enabled: boolean
  source: AmbianceSource
  solidColor: string
  opacity: number
  fit: AmbianceFit
  mediaPath?: string
}

export interface AmbianceTerminal {
  enabled: boolean
  veil: number
  presetColors: boolean
  fontFamily?: string
}

export interface AmbianceAlert {
  enabled: boolean
  effect: AmbianceAlertEffect
  color: string
}

export interface AmbiancePerformance {
  shaderTint: boolean
  shaderQuality: number
  fpsLimit: number
  pauseInactive: boolean
}

export interface AmbianceCompanions {
  enabled: boolean
  size: number
  speed: number
}

export const COMPANION_SIZE_MIN = 14
export const COMPANION_SIZE_MAX = 48
export const COMPANION_SPEED_MIN = 25
export const COMPANION_SPEED_MAX = 200

export interface AmbianceSettings {
  enabled: boolean
  gradient: AmbianceGradient
  background: AmbianceBackground
  interfaceVeil: number
  animatedAccent: boolean
  terminal: AmbianceTerminal
  done: AmbianceAlert
  waiting: AmbianceAlert
  performance: AmbiancePerformance
  companions: AmbianceCompanions
  presets: AmbiancePreset[]
}

export type AppearanceHostMessage =
  | { type: 'appearance.theme'; state: AppearanceState }
  | { type: 'appearance.projectsResolved'; projects: FolderProject[] }
  | { type: 'appearance.ambiance'; ambiance: AmbianceSettings }
  | { type: 'appearance.mediaImported'; name: string }

export type AppearanceWebMessage =
  | { type: 'appearance.projects'; paths: string[] }
  | { type: 'appearance.projectColor'; project: string; color?: string }
  | { type: 'appearance.ambianceEnabled'; enabled: boolean }
  | { type: 'appearance.importMedia'; path: string }
