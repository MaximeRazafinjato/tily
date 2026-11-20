import { AmbianceGradientType, type AmbianceGradient } from '../bridge/appearanceMessages'

export const AMBIENT_GRADIENT_CLASS = 'tily-ambient-gradient'

const CSS_GRADIENT_TYPES = new Set([AmbianceGradientType.Linear, AmbianceGradientType.Radial, AmbianceGradientType.Plasma])
const PLASMA_RADIUS_PERCENT = 14

export const isCssGradient = (type: AmbianceGradientType): boolean => CSS_GRADIENT_TYPES.has(type)

const stopsOf = (colors: string[], band: number, offset: string): string =>
  [...colors, colors[0]].map((color, index) => `${color} ${offset}${Math.round((band * index) / colors.length)}px)`).join(', ')

const plasmaBlobs = (colors: string[], layer: number): string =>
  colors
    .filter((_, index) => index % 2 === layer)
    .map((color, index, layerColors) => {
      const angle = (index / layerColors.length) * Math.PI * 2 + layer
      const x = (50 + Math.cos(angle) * PLASMA_RADIUS_PERCENT).toFixed(1)
      const y = (50 + Math.sin(angle) * PLASMA_RADIUS_PERCENT).toFixed(1)
      return `radial-gradient(circle at ${x}% ${y}%, ${color}, transparent 30%)`
    })
    .join(', ')

const animationOf = (name: string, gradient: AmbianceGradient, reversible: boolean): string =>
  gradient.duration > 0 ? `${name} ${gradient.duration}s linear infinite${reversible && gradient.reverse ? ' reverse' : ''}` : 'none'

const plasmaCss = (gradient: AmbianceGradient, scope: string): string => `
  .${scope}::before, .${scope}::after { inset: -50%; }
  .${scope}::before { background: ${plasmaBlobs(gradient.colors, 0)}; animation: ${animationOf('tily-ambiance-plasma-a', gradient, true)}; }
  .${scope}::after { mix-blend-mode: screen; background: ${plasmaBlobs(gradient.colors, 1)}; animation: ${animationOf('tily-ambiance-plasma-b', gradient, true)}; }`

const radialCss = (gradient: AmbianceGradient, scope: string): string => {
  const [from, to] = gradient.reverse ? [`${gradient.band}px`, '0px'] : ['0px', `${gradient.band}px`]
  return `
  @keyframes ${scope}-radial { from { --tily-ambiance-shift: ${from}; } to { --tily-ambiance-shift: ${to}; } }
  .${scope}::before {
    inset: 0;
    background: repeating-radial-gradient(circle at 50% 50%, ${stopsOf(gradient.colors, gradient.band, 'calc(var(--tily-ambiance-shift) + ')});
    animation: ${animationOf(`${scope}-radial`, gradient, false)};
  }`
}

const linearCss = (gradient: AmbianceGradient, scope: string): string => {
  const radians = (gradient.angle * Math.PI) / 180
  const sign = gradient.reverse ? -1 : 1
  const shiftX = (Math.sin(radians) * gradient.band * sign).toFixed(2)
  const shiftY = (-Math.cos(radians) * gradient.band * sign).toFixed(2)
  return `
  @keyframes ${scope}-linear { from { transform: translate(0, 0); } to { transform: translate(${shiftX}px, ${shiftY}px); } }
  .${scope}::before {
    inset: -${gradient.band}px;
    background: repeating-linear-gradient(${gradient.angle}deg, ${stopsOf(gradient.colors, gradient.band, 'calc(')});
    animation: ${animationOf(`${scope}-linear`, gradient, false)};
  }`
}

export const gradientCss = (gradient: AmbianceGradient, scope: string): string => {
  switch (gradient.type) {
    case AmbianceGradientType.Plasma:
      return plasmaCss(gradient, scope)
    case AmbianceGradientType.Radial:
      return radialCss(gradient, scope)
    default:
      return linearCss(gradient, scope)
  }
}

export const gradientPreview = (colors: string[]): string => `linear-gradient(90deg, ${colors.join(', ')})`
