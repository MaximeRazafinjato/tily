import type { CompanionOutfit } from '../../bridge/appearanceMessages'
import type { CompanionTrail } from './cosmeticCatalog'

export interface TracePoint {
  x: number
  y: number
  ground: number
  t: number
  pose: FigurePose
}

export interface FigurePose {
  dx: number
  dy: number
  sx: number
  sy: number
  rotation: number
  time: number
  hue: number
}

export interface EffectState {
  frame: number
  heldX: number
  heldY: number
  heldTime: number
  nextAt: number
  startedAt: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  toPerch: Element | null
  moved: boolean
  dashed: boolean
  spawn: number
  side: number
}

export interface TrailParticle {
  kind: CompanionTrail
  x: number
  y: number
  vx: number
  vy: number
  gravity: number
  life: number
  max: number
  size: number
  rotation: number
  spin: number
  seed: number
  color: string
  floor: number | null
}

export interface WardrobeFocus {
  key: string
  homeX: number
  open: boolean
  progress: number
  bumpAt: number
  ring: number
  preview: CompanionOutfit | null
}

export const createEffectState = (): EffectState => ({
  frame: -1,
  heldX: 0,
  heldY: 0,
  heldTime: 0,
  nextAt: 0,
  startedAt: -Infinity,
  fromX: 0,
  fromY: 0,
  toX: 0,
  toY: 0,
  toPerch: null,
  moved: false,
  dashed: false,
  spawn: 0,
  side: 1,
})
