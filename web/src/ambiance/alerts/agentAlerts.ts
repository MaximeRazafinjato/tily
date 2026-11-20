import { AmbianceAlertEffect, type AmbianceAlert } from '../../bridge/appearanceMessages'
import { AttentionKind } from '../../bridge/messages'
import { useAppearanceStore } from '../../store/appearanceStore'
import { playConfetti, playFireworks, playMatrix, playWarp } from './canvasAlerts'
import { playBanner, playFlash, playGlitch, playLaser, playOrbit, playPulse, playRays, playShake, playWave } from './overlayAlerts'

const LABELS: Record<AttentionKind, string> = {
  [AttentionKind.Done]: 'TERMINÉ',
  [AttentionKind.Waiting]: 'EN ATTENTE',
}

const PLAYERS: Record<AmbianceAlertEffect, (color: string, label: string) => void> = {
  [AmbianceAlertEffect.Pulse]: playPulse,
  [AmbianceAlertEffect.Wave]: playWave,
  [AmbianceAlertEffect.Confetti]: playConfetti,
  [AmbianceAlertEffect.Flash]: playFlash,
  [AmbianceAlertEffect.Shake]: playShake,
  [AmbianceAlertEffect.Glitch]: playGlitch,
  [AmbianceAlertEffect.Fireworks]: playFireworks,
  [AmbianceAlertEffect.Laser]: playLaser,
  [AmbianceAlertEffect.Orbit]: playOrbit,
  [AmbianceAlertEffect.Rays]: playRays,
  [AmbianceAlertEffect.Matrix]: playMatrix,
  [AmbianceAlertEffect.Warp]: playWarp,
  [AmbianceAlertEffect.Banner]: playBanner,
}

export const playAlert = (alert: AmbianceAlert, kind: AttentionKind): void => PLAYERS[alert.effect](alert.color, LABELS[kind])

export const playAgentAlert = (kind: AttentionKind): void => {
  const ambiance = useAppearanceStore.getState().ambiance
  const alert = kind === AttentionKind.Done ? ambiance?.done : ambiance?.waiting
  if (ambiance?.enabled && alert?.enabled) {
    playAlert(alert, kind)
  }
}
