import { BlobMood, createBlob, createWorld, resize, setMood, SHAPE_ORDER, type Blob } from './blobModel'
import { updateBlob, updateParticles } from './blobPhysics'
import { drawBlob, drawParticles } from './blobRenderer'

const TOOLS = ['Bash', 'Read', 'Edit', 'Grep', '']
const FLOOR_MARGIN = 70
const MAX_STEP_S = 0.05

const stage = document.getElementById('stage') as HTMLCanvasElement
const context = stage.getContext('2d') as CanvasRenderingContext2D
const moodSelect = document.getElementById('mood') as HTMLSelectElement
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const sizeInput = document.getElementById('size') as HTMLInputElement
const movingInput = document.getElementById('moving') as HTMLInputElement

const world = createWorld(Number(sizeInput.value), 1, false)
const homes = new Map<Blob, number>()

const labelOf = (tool: string): string => tool || 'Sans outil'

const fit = (): void => {
  const zoom = Number(zoomInput.value)
  const ratio = devicePixelRatio
  stage.width = Math.round(stage.clientWidth * ratio)
  stage.height = Math.round(stage.clientHeight * ratio)
  context.setTransform(ratio * zoom, 0, 0, ratio * zoom, 0, 0)
  world.width = stage.clientWidth / zoom
  world.height = stage.clientHeight / zoom
  const floor = world.height - FLOOR_MARGIN
  world.perches = [{ element: stage, x1: 0, x2: world.width, y: floor }]
  world.blobs.forEach((blob, index) => {
    const home = (world.width / (TOOLS.length + 1)) * (index + 1)
    homes.set(blob, home)
    placeHome(blob)
  })
}

const placeHome = (blob: Blob): void => {
  blob.x = homes.get(blob) ?? blob.x
  blob.y = world.perches[0].y
  blob.vx = 0
  blob.vy = 0
  blob.perch = stage
  blob.targetX = blob.x
}

TOOLS.forEach((tool, index) => {
  const blob = createBlob(world, `demo-${index}`, `demo-${index}`, (index * 67) % 360, null)
  blob.shape = SHAPE_ORDER[index % SHAPE_ORDER.length]
  blob.name = labelOf(tool)
  blob.tool = tool
  blob.grow = 1
  blob.mood = BlobMood.Working
  blob.reported = BlobMood.Working
  world.blobs.push(blob)
})
fit()

moodSelect.addEventListener('change', () => world.blobs.forEach((blob) => setMood(world, blob, moodSelect.value as BlobMood)))
zoomInput.addEventListener('input', fit)
sizeInput.addEventListener('input', () => {
  world.size = Number(sizeInput.value)
  resize(world)
})
movingInput.addEventListener('change', () => {
  if (!movingInput.checked) {
    world.blobs.forEach(placeHome)
  }
})
addEventListener('resize', fit)

let previous = performance.now()
const tick = (now: number): void => {
  requestAnimationFrame(tick)
  const dt = Math.min(MAX_STEP_S, (now - previous) / 1000)
  previous = now
  world.clock += dt
  world.blobs.forEach((blob) => {
    if (movingInput.checked) {
      updateBlob(world, blob, dt)
    } else {
      blob.clock += dt
      blob.moodTime += dt
    }
  })
  updateParticles(world, dt)
  context.clearRect(0, 0, world.width, world.height)
  world.blobs.forEach((blob) => drawBlob(context, world, blob))
  drawParticles(context, world)
  context.fillStyle = '#e7e4f5'
  context.font = '600 13px system-ui, sans-serif'
  context.textAlign = 'center'
  world.blobs.forEach((blob) => context.fillText(blob.name, homes.get(blob) ?? blob.x, world.perches[0].y + 28))
}
requestAnimationFrame(tick)
