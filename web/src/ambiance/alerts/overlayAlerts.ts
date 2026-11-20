import { ALERT_MS, appRoot, EASE_OUT, easedFrames, inverseOf, randomBetween, removeWhenDone, spawnOverlay } from './alertKit'

const SHAKE_FRAMES = 14
const SHAKE_FORCE = 12
const GLITCH_SLICES = 18
const BEAM_TRAIL = 160

export const playPulse = (color: string): void => {
  const element = spawnOverlay('div', { position: 'absolute', inset: '0', boxShadow: `inset 0 0 0 3px ${color}, inset 0 0 80px 16px ${color}` })
  removeWhenDone(element, element.animate(easedFrames([{ opacity: 0 }, { opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }, { opacity: 0 }]), { duration: ALERT_MS }))
}

export const playWave = (color: string): void => {
  const size = Math.hypot(innerWidth, innerHeight) * 2
  const element = spawnOverlay('div', {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: `${size}px`,
    height: `${size}px`,
    margin: `${-size / 2}px 0 0 ${-size / 2}px`,
    borderRadius: '50%',
    background: `radial-gradient(closest-side, transparent 68%, ${color} 84%, transparent 100%)`,
  })
  removeWhenDone(element, element.animate([{ transform: 'scale(0)', opacity: 0.9 }, { transform: 'scale(0.6)', opacity: 0.7 }, { transform: 'scale(1)', opacity: 0 }], { duration: ALERT_MS, easing: EASE_OUT }))
}

export const playFlash = (color: string): void => {
  const element = spawnOverlay('div', { position: 'absolute', inset: '0', background: `radial-gradient(circle, white 0%, ${color} 45%, transparent 100%)`, mixBlendMode: 'screen' })
  const frames = easedFrames([{ opacity: 0 }, { opacity: 0.9, offset: 0.05 }, { opacity: 0, offset: 0.18 }, { opacity: 0.7, offset: 0.24 }, { opacity: 0, offset: 0.4 }, { opacity: 0.35, offset: 0.46 }, { opacity: 0 }])
  removeWhenDone(element, element.animate(frames, { duration: ALERT_MS * 0.7 }))
}

export const playShake = (color: string): void => {
  const inverse = inverseOf(color)
  const frames: Keyframe[] = Array.from({ length: SHAKE_FRAMES }, (_, index) => {
    const force = (1 - index / SHAKE_FRAMES) * SHAKE_FORCE
    return {
      transform: `translate(${randomBetween(-force, force)}px, ${randomBetween(-force, force)}px) rotate(${randomBetween(-force, force) / SHAKE_FORCE}deg)`,
      filter: `drop-shadow(${force / 2}px 0 ${color}) drop-shadow(${-force / 2}px 0 ${inverse})`,
    }
  })
  appRoot()?.animate([...frames, { transform: 'none', filter: 'none' }], { duration: 750, easing: EASE_OUT })
}

export const playGlitch = (color: string): void => {
  const inverse = inverseOf(color)
  for (let index = 0; index < GLITCH_SLICES; index++) {
    const slice = spawnOverlay('div', {
      position: 'absolute',
      left: '0',
      right: '0',
      top: `${randomBetween(0, 100)}%`,
      height: `${randomBetween(2, 48)}px`,
      background: index % 3 ? color : inverse,
      mixBlendMode: 'difference',
      opacity: '0',
    })
    const frames: Keyframe[] = Array.from({ length: 8 }, () => ({
      opacity: Math.random() < 0.5 ? 0 : randomBetween(0.4, 1),
      transform: `translateX(${randomBetween(-60, 60)}px) scaleY(${randomBetween(0.3, 2)})`,
      easing: 'steps(1, end)',
    }))
    removeWhenDone(slice, slice.animate([...frames, { opacity: 0 }], { duration: randomBetween(500, 1100), delay: randomBetween(0, 600), fill: 'backwards' }))
  }
  const jitter: Keyframe[] = Array.from({ length: 7 }, () => ({
    filter: `hue-rotate(${randomBetween(-90, 90)}deg) saturate(${randomBetween(1, 3)})`,
    transform: `translateX(${randomBetween(-6, 6)}px)`,
    easing: 'steps(1, end)',
  }))
  appRoot()?.animate([...jitter, { filter: 'none', transform: 'none' }], { duration: 900 })
}

const sweepBeam = (color: string, vertical: boolean, delay: number): void => {
  const beam = spawnOverlay('div', {
    position: 'absolute',
    top: '0',
    left: '0',
    ...(vertical ? { bottom: '0', width: `${BEAM_TRAIL}px` } : { right: '0', height: `${BEAM_TRAIL}px` }),
    background: `linear-gradient(to ${vertical ? 'right' : 'bottom'}, transparent, color-mix(in srgb, ${color} 30%, transparent))`,
  })
  const line = document.createElement('div')
  Object.assign(line.style, {
    position: 'absolute',
    right: '0',
    bottom: '0',
    ...(vertical ? { top: '0', width: '2px' } : { left: '0', height: '2px' }),
    background: 'white',
    boxShadow: `0 0 10px 2px ${color}, 0 0 40px 8px ${color}`,
  })
  beam.append(line)
  const axis = vertical ? 'X' : 'Y'
  const end = (vertical ? innerWidth : innerHeight) - BEAM_TRAIL
  const frames = easedFrames([
    { transform: `translate${axis}(${-BEAM_TRAIL}px)`, opacity: 1 },
    { transform: `translate${axis}(${end}px)`, opacity: 1, offset: 0.85 },
    { transform: `translate${axis}(${end}px)`, opacity: 0 },
  ])
  removeWhenDone(beam, beam.animate(frames, { duration: 1300, delay, fill: 'backwards' }))
}

export const playLaser = (color: string): void => {
  sweepBeam(color, false, 0)
  sweepBeam(color, true, 250)
}

export const playOrbit = (color: string): void => {
  const frame: Partial<CSSStyleDeclaration> = {
    position: 'absolute',
    inset: '0',
    background: `conic-gradient(from var(--tily-ambiance-orbit), transparent 0 30%, ${color} 48%, white 50%, transparent 50% 80%, ${color} 98%, white 100%)`,
    maskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
    maskClip: 'content-box, border-box',
    maskComposite: 'exclude',
  }
  const glow = spawnOverlay('div', { ...frame, padding: '18px', filter: 'blur(12px)' })
  const line = spawnOverlay('div', { ...frame, padding: '3px' })
  for (const element of [glow, line]) {
    element.animate([{ '--tily-ambiance-orbit': '0deg' }, { '--tily-ambiance-orbit': '540deg' }], { duration: ALERT_MS, easing: EASE_OUT })
    removeWhenDone(element, element.animate(easedFrames([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }]), { duration: ALERT_MS }))
  }
}

export const playRays = (color: string): void => {
  const size = Math.hypot(innerWidth, innerHeight)
  const element = spawnOverlay('div', {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: `${size}px`,
    height: `${size}px`,
    margin: `${-size / 2}px 0 0 ${-size / 2}px`,
    background: `repeating-conic-gradient(${color} 0deg 1.5deg, transparent 2deg 7deg)`,
    maskImage: 'radial-gradient(circle, transparent 18%, #000 60%)',
    mixBlendMode: 'screen',
  })
  const frames = easedFrames([
    { transform: 'rotate(0deg) scale(1.4)', opacity: 0 },
    { transform: 'rotate(8deg) scale(1)', opacity: 0.9, offset: 0.15 },
    { transform: 'rotate(25deg) scale(1.05)', opacity: 0 },
  ])
  removeWhenDone(element, element.animate(frames, { duration: ALERT_MS }))
}

export const playBanner = (color: string, label: string): void => {
  const band = spawnOverlay('div', {
    position: 'absolute',
    left: '-10%',
    right: '-10%',
    top: '50%',
    height: '120px',
    marginTop: '-60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${color} 35%, transparent) 20% 80%, transparent)`,
    borderBlock: `2px solid ${color}`,
    boxShadow: `0 0 40px ${color}`,
    backdropFilter: 'blur(6px)',
    transform: 'skewY(-4deg)',
  })
  const text = document.createElement('div')
  text.textContent = label
  Object.assign(text.style, {
    font: 'italic 900 64px var(--font-sans)',
    letterSpacing: '.3em',
    color: 'white',
    whiteSpace: 'nowrap',
    textShadow: `0 0 8px ${color}, 0 0 24px ${color}, 0 0 48px ${color}`,
  })
  band.append(text)
  const bandFrames = easedFrames([
    { clipPath: 'inset(50% 0 50% 0)', opacity: 1 },
    { clipPath: 'inset(0 0 0 0)', offset: 0.15 },
    { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0.8 },
    { clipPath: 'inset(50% 0 50% 0)', opacity: 0 },
  ])
  removeWhenDone(band, band.animate(bandFrames, { duration: ALERT_MS }))
  const textFrames = easedFrames([
    { transform: 'translateX(30%)', letterSpacing: '.6em', opacity: 0 },
    { transform: 'translateX(0)', letterSpacing: '.3em', opacity: 1, offset: 0.2 },
    { transform: 'translateX(-3%)', opacity: 1, offset: 0.8 },
    { transform: 'translateX(-30%)', opacity: 0 },
  ])
  text.animate(textFrames, { duration: ALERT_MS })
}
