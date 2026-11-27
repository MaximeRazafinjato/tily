import { CompanionSkin } from './cosmeticCatalog'
import { CLAY_SKINS } from './claySkins'
import { REALISTIC_SKIN } from './realisticSkin'
import { RETRO_SKINS } from './retroSkins'
import { plainPaint, type SkinStyle } from './skinPaint'

const PIXEL_SIZE_RATIO = 6.5
const PIXEL_MIN_SIZE = 2.5
const PIXEL_FPS = 10
const ARCADE_OUTLINE_POINTS = 56

const PLAIN: SkinStyle = { paint: plainPaint }

const SKINS: Partial<Record<CompanionSkin, SkinStyle>> = {
  ...CLAY_SKINS,
  ...RETRO_SKINS,
  [CompanionSkin.Realistic]: REALISTIC_SKIN,
}

export const skinStyle = (skin: string | undefined): SkinStyle => SKINS[skin as CompanionSkin] ?? PLAIN

export const outlineCount = (skin: string | undefined, fallback: number): number => (skin === CompanionSkin.ArcadeGhost || skin === CompanionSkin.Ghost ? ARCADE_OUTLINE_POINTS : fallback)

export const pixelSize = (skin: string | undefined, radius: number): number => (skinStyle(skin).pixelated ? Math.max(PIXEL_MIN_SIZE, radius / PIXEL_SIZE_RATIO) : 0)

export const pixelTime = (time: number): number => Math.floor(time * PIXEL_FPS) / PIXEL_FPS
