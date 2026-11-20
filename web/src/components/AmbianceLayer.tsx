import { useEffect, useRef } from 'react'
import { AmbianceGradientType, AmbianceSource, type AmbianceSettings } from '../bridge/appearanceMessages'
import { AMBIENT_GRADIENT_CLASS, gradientCss, isCssGradient } from '../ambiance/gradientStyle'
import { isVideo, mediaUrlOf } from '../ambiance/ambianceActions'
import { startParticles } from '../ambiance/particleRenderer'
import { startShader } from '../ambiance/shaderRenderer'
import { StatusLevel, useHostStore } from '../store/hostStore'

interface AmbianceLayerProps {
  ambiance: AmbianceSettings
  scope: string
  className: string
}

enum CanvasKind {
  Particles = 'particles',
  Shader = 'shader',
}

const reportError = (message: string) => useHostStore.getState().setStatus(message, StatusLevel.Warning)

const canvasKindOf = (ambiance: AmbianceSettings): CanvasKind | null => {
  if (ambiance.background.source !== AmbianceSource.Gradient || isCssGradient(ambiance.gradient.type)) {
    return null
  }
  return ambiance.gradient.type === AmbianceGradientType.Particles ? CanvasKind.Particles : CanvasKind.Shader
}

export function AmbianceLayer({ ambiance, scope, className }: AmbianceLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef(ambiance)
  const kind = canvasKindOf(ambiance)

  useEffect(() => {
    latest.current = ambiance
  }, [ambiance])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !kind) {
      return undefined
    }
    const read = () => latest.current
    return kind === CanvasKind.Particles ? startParticles(canvas, read) : startShader(canvas, read, reportError)
  }, [kind])

  const { background, gradient } = ambiance
  const opacity = background.opacity / 100
  if (background.source === AmbianceSource.Solid) {
    return <div aria-hidden="true" className={className} style={{ backgroundColor: background.solidColor, opacity }} />
  }

  if (kind) {
    return <canvas key={kind} ref={canvasRef} aria-hidden="true" className={`${className} h-full w-full`} style={{ opacity }} />
  }

  if (background.source === AmbianceSource.Media) {
    if (!background.mediaPath) {
      return null
    }
    const media = { className: `${className} h-full w-full`, style: { opacity, objectFit: background.fit } }
    return isVideo(background.mediaPath) ? <video key={background.mediaPath} aria-hidden="true" src={mediaUrlOf(background.mediaPath)} autoPlay loop muted playsInline {...media} /> : <img alt="" src={mediaUrlOf(background.mediaPath)} {...media} />
  }

  if (background.source === AmbianceSource.Gradient) {
    return (
      <div aria-hidden="true" className={`${className} ${AMBIENT_GRADIENT_CLASS} ${scope}`} style={{ opacity }}>
        <style>{gradientCss(gradient, scope)}</style>
      </div>
    )
  }

  return null
}
