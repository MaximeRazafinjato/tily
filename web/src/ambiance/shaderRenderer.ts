import type { AmbianceGradientType } from '../bridge/appearanceMessages'
import { fitCanvas, hexToRgb, shouldRender, speedOf, type AmbianceReader } from './renderPacing'
import { SHADER_COMMON, SHADERS, VERTEX_SHADER } from './shaderSources'

interface CompiledShader {
  program: WebGLProgram
  resolution: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
  tint: WebGLUniformLocation | null
  colors: WebGLUniformLocation | null
  day: WebGLUniformLocation | null
}

const SECONDS_PER_DAY = 86400
const FULL_SCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3])

const dayFraction = (date: Date): number => (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / SECONDS_PER_DAY

const compile = (gl: WebGLRenderingContext, type: AmbianceGradientType): CompiledShader => {
  const program = gl.createProgram()
  const attach = (kind: number, source: string) => {
    const shader = gl.createShader(kind)
    if (!shader) {
      throw new Error('shader introuvable')
    }
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'erreur inconnue')
    }
    gl.attachShader(program, shader)
  }
  attach(gl.VERTEX_SHADER, VERTEX_SHADER)
  attach(gl.FRAGMENT_SHADER, SHADER_COMMON + (SHADERS[type] ?? ''))
  gl.bindAttribLocation(program, 0, 'a')
  gl.linkProgram(program)
  const uniform = (name: string) => gl.getUniformLocation(program, name)
  return { program, resolution: uniform('R'), time: uniform('T'), tint: uniform('P'), colors: uniform('C'), day: uniform('D') }
}

export const startShader = (canvas: HTMLCanvasElement, read: AmbianceReader, onError: (message: string) => void): (() => void) => {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' })
  if (!gl) {
    onError('WebGL indisponible : les décors en shader ne peuvent pas s’afficher.')
    return () => undefined
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, FULL_SCREEN_TRIANGLE, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const programs = new Map<AmbianceGradientType, CompiledShader>()
  let previous = 0
  let frame = 0
  const draw = (now: number) => {
    frame = requestAnimationFrame(draw)
    const { gradient, performance: pacing } = read()
    if (!shouldRender(pacing, now, previous)) {
      return
    }
    previous = now
    let compiled = programs.get(gradient.type)
    if (!compiled) {
      try {
        compiled = compile(gl, gradient.type)
      } catch (error) {
        cancelAnimationFrame(frame)
        onError(`Impossible de compiler le décor : ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      programs.set(gradient.type, compiled)
    }
    fitCanvas(canvas, pacing.shaderQuality / 100)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(compiled.program)
    gl.uniform2f(compiled.resolution, canvas.width, canvas.height)
    gl.uniform1f(compiled.time, (now / 1000) * speedOf(gradient))
    gl.uniform1f(compiled.tint, pacing.shaderTint ? 1 : 0)
    gl.uniform3fv(compiled.colors, [0, 1, 2].flatMap((index) => hexToRgb(gradient.colors[index % gradient.colors.length]).map((channel) => channel / 255)))
    gl.uniform1f(compiled.day, dayFraction(new Date()))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  frame = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(frame)
    programs.forEach((compiled) => gl.deleteProgram(compiled.program))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
