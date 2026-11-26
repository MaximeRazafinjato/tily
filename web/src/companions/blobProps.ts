import { BlobMood, lerp, type Blob } from './blobModel'

const INK = '#1a1530'
const PAGE = '#fffdf5'
const SPARK = '#ffe58a'
const WOOD = '#c28a52'
const KEYBOARD = '#3a3f55'
const KEY = '#c9cdd8'
const COVER = '#7f5fae'
const TURNING_PAGE = '#f3ecd8'
const TEXT_LINE = '#cfc8b4'
const PENCIL = '#ffd84a'
const ERASER = '#f4a4b8'
const PENCIL_WOOD = '#f3d9b1'
const WRITING = '#3d5a9e'
const LENS_TINT = 'rgba(255, 255, 255, 0.28)'
const LENS_GLARE = 'rgba(255, 255, 255, 0.67)'
const LENS_RIM = '#c9cdd8'

enum ToolAction {
  None = 'none',
  Type = 'type',
  Read = 'read',
  Write = 'write',
  Search = 'search',
}

const ACTIONS: Record<string, ToolAction> = {
  Bash: ToolAction.Type,
  Read: ToolAction.Read,
  Edit: ToolAction.Write,
  MultiEdit: ToolAction.Write,
  Write: ToolAction.Write,
  NotebookEdit: ToolAction.Write,
  Grep: ToolAction.Search,
  Glob: ToolAction.Search,
  WebSearch: ToolAction.Search,
  WebFetch: ToolAction.Search,
}

const actionOf = (blob: Blob): ToolAction => (blob.mood === BlobMood.Working ? (ACTIONS[blob.tool] ?? ToolAction.None) : ToolAction.None)

const phaseOf = (time: number, period: number): number => (((time / period) % 1) + 1) % 1

const smoothstep = (progress: number): number => progress * progress * (3 - 2 * progress)

const outlineWidth = (radius: number): number => Math.max(2, radius * 0.07)

const READ_SCAN_S = 1.1
const READ_SCAN_SPLIT = 0.85

const readingLook = (blob: Blob): number => {
  const phase = phaseOf(blob.clock, READ_SCAN_S)
  return phase < READ_SCAN_SPLIT ? lerp(-0.9, 0.9, smoothstep(phase / READ_SCAN_SPLIT)) : lerp(0.9, -0.9, smoothstep((phase - READ_SCAN_SPLIT) / (1 - READ_SCAN_SPLIT)))
}

const toolLook = (blob: Blob): { x: number; y: number } | null => {
  switch (actionOf(blob)) {
    case ToolAction.Type:
      return { x: 0, y: 0.8 }
    case ToolAction.Read:
      return { x: readingLook(blob), y: 0.9 }
    case ToolAction.Write:
      return { x: 0.4, y: 0.9 }
    case ToolAction.Search:
      return { x: 0.6, y: -0.1 }
    default:
      return null
  }
}

export const faceOffset = (blob: Blob, radius: number): { x: number; y: number } => {
  const look = toolLook(blob) ?? { x: blob.lookX, y: blob.lookY }
  return { x: look.x * radius * 0.12, y: look.y * radius * 0.1 - radius * 0.12 }
}

const drawHand = (context: CanvasRenderingContext2D, blob: Blob, radius: number, x: number, y: number): void => {
  context.fillStyle = `hsl(${blob.hue}, 85%, 72%)`
  context.lineWidth = outlineWidth(radius) * 0.9
  context.beginPath()
  context.arc(x, y, radius * 0.13, 0, Math.PI * 2)
  context.fill()
  context.stroke()
}

const drawGlasses = (context: CanvasRenderingContext2D, blob: Blob, radius: number): void => {
  const { x, y: eyeY } = faceOffset(blob, radius)
  const y = eyeY + radius * 0.14
  const lens = radius * 0.19
  context.lineWidth = Math.max(1.5, radius * 0.06)
  context.fillStyle = 'rgba(190, 225, 255, 0.35)'
  for (const side of [-1, 1]) {
    context.beginPath()
    context.arc(x + side * radius * 0.33, y, lens, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }
  context.beginPath()
  context.moveTo(x - radius * 0.33 + lens, y)
  context.lineTo(x + radius * 0.33 - lens, y)
  context.stroke()
}

const KEY_ORDER = [3, 8, 1, 10, 5, 7, 0, 11, 2, 9, 4, 6]
const KEY_COLUMNS = 6
const KEYS_PER_S = 9

const drawKeyboard = (context: CanvasRenderingContext2D, blob: Blob, radius: number): void => {
  const width = radius * 1.5
  const height = radius * 0.42
  const left = -width / 2
  const top = radius * 0.5
  const line = outlineWidth(radius)
  context.lineWidth = line
  context.fillStyle = KEYBOARD
  context.beginPath()
  context.roundRect(left, top, width, height, radius * 0.1)
  context.fill()
  context.stroke()
  const keyWidth = (width - radius * 0.2) / KEY_COLUMNS
  const pressed = KEY_ORDER[Math.floor(blob.clock * KEYS_PER_S) % KEY_ORDER.length]
  context.lineWidth = line * 0.5
  for (let key = 0; key < KEY_ORDER.length; key++) {
    const x = left + radius * 0.1 + (key % KEY_COLUMNS) * keyWidth
    const y = top + radius * 0.08 + Math.floor(key / KEY_COLUMNS) * height * 0.42 + (key === pressed ? radius * 0.03 : 0)
    context.fillStyle = key === pressed ? SPARK : KEY
    context.beginPath()
    context.roundRect(x + 1, y, keyWidth - 2, height * 0.36, radius * 0.05)
    context.fill()
    context.stroke()
  }
  const column = pressed % KEY_COLUMNS
  const pressX = left + radius * 0.1 + column * keyWidth + keyWidth / 2
  const pressY = top + radius * 0.06 + Math.floor(pressed / KEY_COLUMNS) * height * 0.42
  const restY = top - radius * 0.02
  const leftHandTyping = column < KEY_COLUMNS / 2
  drawHand(context, blob, radius, leftHandTyping ? pressX : -radius * 0.4, leftHandTyping ? pressY : restY)
  drawHand(context, blob, radius, leftHandTyping ? radius * 0.4 : pressX, leftHandTyping ? restY : pressY)
}

const PAGE_TURN_S = 2.2
const PAGE_TURN_SHARE = 0.35

const pagePath = (context: CanvasRenderingContext2D, top: number, edge: number, height: number, lift: number): void => {
  context.beginPath()
  context.moveTo(0, top + height * 0.1)
  context.quadraticCurveTo(edge * 0.5, top - height * 0.06 - lift * 1.2, edge, top - lift)
  context.lineTo(edge, top + height - lift)
  context.quadraticCurveTo(edge * 0.5, top + height - height * 0.1, 0, top + height + height * 0.03)
  context.closePath()
}

const drawBook = (context: CanvasRenderingContext2D, blob: Blob, radius: number): void => {
  const top = radius * 0.32
  const pageWidth = radius * 0.62
  const height = radius * 0.62
  const line = outlineWidth(radius)
  context.lineWidth = line
  context.fillStyle = COVER
  context.beginPath()
  context.moveTo(0, top + radius * 0.04)
  context.lineTo(-pageWidth - radius * 0.06, top + radius * 0.06)
  context.lineTo(-pageWidth - radius * 0.06, top + height + radius * 0.08)
  context.lineTo(pageWidth + radius * 0.06, top + height + radius * 0.08)
  context.lineTo(pageWidth + radius * 0.06, top + radius * 0.06)
  context.closePath()
  context.fill()
  context.stroke()
  for (const side of [-1, 1]) {
    context.lineWidth = line * 0.8
    context.strokeStyle = INK
    context.fillStyle = PAGE
    pagePath(context, top, side * pageWidth, height, 0)
    context.fill()
    context.stroke()
    context.strokeStyle = TEXT_LINE
    context.lineWidth = radius * 0.035
    for (let row = 0; row < 4; row++) {
      context.beginPath()
      context.moveTo(side * pageWidth * 0.18, top + radius * 0.16 + row * radius * 0.12)
      context.lineTo(side * pageWidth * (row === 3 ? 0.55 : 0.82), top + radius * 0.14 + row * radius * 0.12)
      context.stroke()
    }
  }
  context.strokeStyle = INK
  const turn = phaseOf(blob.clock, PAGE_TURN_S)
  if (turn < PAGE_TURN_SHARE) {
    const angle = smoothstep(turn / PAGE_TURN_SHARE) * Math.PI
    context.lineWidth = line * 0.8
    context.fillStyle = TURNING_PAGE
    pagePath(context, top, Math.cos(angle) * pageWidth, height, radius * 0.1 * Math.sin(angle))
    context.fill()
    context.stroke()
  }
  drawHand(context, blob, radius, -pageWidth - radius * 0.02, top + height * 0.6)
  drawHand(context, blob, radius, pageWidth + radius * 0.02, top + height * 0.6)
}

const WRITE_CYCLE_S = 3.6
const WRITE_LINES = 3
const WRITE_STEPS = 30

const drawPencil = (context: CanvasRenderingContext2D, radius: number, x: number, y: number, angle: number): void => {
  const length = radius * 0.85
  const width = radius * 0.17
  context.save()
  context.translate(x, y)
  context.rotate(angle)
  context.lineWidth = outlineWidth(radius) * 0.85
  context.strokeStyle = INK
  context.fillStyle = PENCIL
  context.beginPath()
  context.roundRect(-width / 2, -length, width, length * 0.78, width * 0.25)
  context.fill()
  context.stroke()
  context.fillStyle = ERASER
  context.beginPath()
  context.roundRect(-width / 2, -length - width * 0.55, width, width * 0.7, width * 0.3)
  context.fill()
  context.stroke()
  context.fillStyle = PENCIL_WOOD
  context.beginPath()
  context.moveTo(-width / 2, -length * 0.22)
  context.lineTo(0, 0)
  context.lineTo(width / 2, -length * 0.22)
  context.closePath()
  context.fill()
  context.stroke()
  context.fillStyle = INK
  context.beginPath()
  context.moveTo(-width * 0.16, -length * 0.07)
  context.lineTo(0, 0)
  context.lineTo(width * 0.16, -length * 0.07)
  context.closePath()
  context.fill()
  context.restore()
}

const drawWriting = (context: CanvasRenderingContext2D, blob: Blob, radius: number): void => {
  const sheetX = radius * 0.35
  const sheetY = radius * 0.62
  const width = radius * 1.05
  const height = radius * 0.72
  const tilt = -0.05
  context.save()
  context.translate(sheetX, sheetY)
  context.rotate(tilt)
  context.lineWidth = outlineWidth(radius) * 0.85
  context.fillStyle = PAGE
  context.beginPath()
  context.roundRect(-width / 2, -height / 2, width, height, radius * 0.06)
  context.fill()
  context.stroke()
  const progress = phaseOf(blob.clock, WRITE_CYCLE_S) * WRITE_LINES
  const current = Math.floor(progress)
  let tip: [number, number] = [-width / 2 + radius * 0.12, -height / 2 + radius * 0.18]
  context.strokeStyle = WRITING
  context.lineWidth = radius * 0.045
  for (let row = 0; row <= Math.min(current, WRITE_LINES - 1); row++) {
    const filled = row < current ? 1 : progress - current
    const y = -height / 2 + radius * 0.18 + row * radius * 0.2
    const start = -width / 2 + radius * 0.12
    const length = (width - radius * 0.3) * (row === WRITE_LINES - 1 ? 0.6 : 1)
    const steps = Math.max(2, Math.floor(WRITE_STEPS * filled))
    context.beginPath()
    for (let step = 0; step <= steps; step++) {
      const ratio = step / WRITE_STEPS
      const pointX = start + ratio * length
      const pointY = y + Math.sin(ratio * 40 + row) * radius * 0.035
      if (step === 0) {
        context.moveTo(pointX, pointY)
      } else {
        context.lineTo(pointX, pointY)
      }
      tip = [pointX, pointY]
    }
    context.stroke()
  }
  context.restore()
  context.strokeStyle = INK
  const tipX = sheetX + tip[0] * Math.cos(tilt) - tip[1] * Math.sin(tilt)
  const tipY = sheetY + tip[0] * Math.sin(tilt) + tip[1] * Math.cos(tilt)
  drawPencil(context, radius, tipX, tipY, 0.5 + Math.sin(blob.clock * 30) * 0.04)
  drawHand(context, blob, radius, tipX + radius * 0.3, tipY - radius * 0.42)
}

const drawEyeLoupe = (context: CanvasRenderingContext2D, blob: Blob, radius: number): void => {
  const swayX = Math.sin(blob.clock * 1.7) * radius * 0.1
  const swayY = Math.sin(blob.clock * 2.3) * radius * 0.05
  const lensX = radius * 0.36 + swayX
  const lensY = -radius * 0.14 + swayY
  const lens = radius * 0.36
  const handleEndX = lensX + lens * 1.65
  const handleEndY = lensY + lens * 1.65
  context.lineCap = 'round'
  context.lineWidth = radius * 0.14
  context.beginPath()
  context.moveTo(lensX + lens * 0.75, lensY + lens * 0.75)
  context.lineTo(handleEndX, handleEndY)
  context.stroke()
  context.strokeStyle = WOOD
  context.lineWidth = radius * 0.07
  context.stroke()
  context.save()
  context.beginPath()
  context.arc(lensX, lensY, lens, 0, Math.PI * 2)
  context.clip()
  context.fillStyle = `hsl(${blob.hue}, 85%, 70%)`
  context.fillRect(lensX - lens, lensY - lens, lens * 2, lens * 2)
  context.fillStyle = LENS_TINT
  context.fillRect(lensX - lens, lensY - lens, lens * 2, lens * 2)
  const eyeX = radius * 0.33 + swayX * 0.4
  const eyeY = -radius * 0.12 + swayY * 0.4
  const openness = Math.max(0.12, Math.abs(Math.cos((1 - blob.blink) * Math.PI)))
  context.fillStyle = INK
  context.beginPath()
  context.ellipse(eyeX, eyeY, radius * 0.15, radius * 0.24 * openness, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = PAGE
  context.beginPath()
  context.arc(eyeX - radius * 0.05, eyeY - radius * 0.09 * openness, radius * 0.05 * openness, 0, Math.PI * 2)
  context.fill()
  context.restore()
  context.strokeStyle = LENS_GLARE
  context.lineWidth = radius * 0.05
  context.beginPath()
  context.arc(lensX, lensY, lens * 0.7, Math.PI * 1.1, Math.PI * 1.45)
  context.stroke()
  context.strokeStyle = INK
  context.lineWidth = outlineWidth(radius) * 1.1
  context.beginPath()
  context.arc(lensX, lensY, lens, 0, Math.PI * 2)
  context.stroke()
  context.strokeStyle = LENS_RIM
  context.lineWidth = outlineWidth(radius) * 0.5
  context.beginPath()
  context.arc(lensX, lensY, lens - outlineWidth(radius) * 0.55, 0, Math.PI * 2)
  context.stroke()
  context.strokeStyle = INK
  drawHand(context, blob, radius, handleEndX, handleEndY)
}

type PropDrawer = (context: CanvasRenderingContext2D, blob: Blob, radius: number) => void

const PROPS: Record<ToolAction, PropDrawer[]> = {
  [ToolAction.None]: [],
  [ToolAction.Type]: [drawKeyboard],
  [ToolAction.Read]: [drawBook, drawGlasses],
  [ToolAction.Write]: [drawWriting],
  [ToolAction.Search]: [drawEyeLoupe],
}

export const drawProps = (context: CanvasRenderingContext2D, blob: Blob, radius: number): void => {
  const props = PROPS[actionOf(blob)]
  if (props.length === 0) {
    return
  }
  context.save()
  context.strokeStyle = INK
  context.lineCap = 'round'
  context.lineJoin = 'round'
  props.forEach((draw) => {
    context.strokeStyle = INK
    draw(context, blob, radius)
  })
  context.restore()
}
