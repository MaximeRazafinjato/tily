export enum BlobMood {
  Idle = 'idle',
  Working = 'working',
  Waiting = 'waiting',
  Done = 'done',
  Error = 'error',
}

export enum BlobShape {
  Round = 'round',
  Triangle = 'triangle',
  Square = 'square',
  Pentagon = 'pentagon',
  Hexagon = 'hexagon',
}

export const SHAPES: Record<BlobShape, { sides: number; rotation: number }> = {
  [BlobShape.Round]: { sides: 0, rotation: 0 },
  [BlobShape.Triangle]: { sides: 3, rotation: -Math.PI / 2 },
  [BlobShape.Square]: { sides: 4, rotation: Math.PI / 4 },
  [BlobShape.Pentagon]: { sides: 5, rotation: -Math.PI / 2 },
  [BlobShape.Hexagon]: { sides: 6, rotation: 0 },
}

export const SHAPE_ORDER = Object.values(BlobShape)
export const GRAVITY = 2200
export const CHILD_SCALE = 0.5
export const DONE_CELEBRATION_S = 2.5
export const SLEEP_AFTER_S = 5
export const PETTED = 0.3
export const NIGHT_SLEEP_AFTER_S = 2
const NORMAL_CONTEXT = 100_000
const LARGE_CONTEXT = 1_000_000
const EMPTY_CONTEXT_SCALE = 0.7
const MAX_CONTEXT_SCALE = 3

export interface Perch {
  element: Element | null
  x1: number
  x2: number
  y: number
}

export interface Blob {
  key: string
  paneId: string
  name: string
  hue: number
  radius: number
  contextScale: number
  x: number
  y: number
  vx: number
  vy: number
  perch: Element | null
  parent: Blob | null
  children: Blob[]
  mood: BlobMood
  reported: BlobMood | null
  moodTime: number
  idleTime: number
  targetX: number
  tool: string
  squash: number
  squashVelocity: number
  grow: number
  leaving: boolean
  stored: boolean
  blink: number
  nextBlink: number
  lookX: number
  lookY: number
  clock: number
  shape: BlobShape
  poke: number
  shake: number
  errorMix: number
  hopTimer: number
  dizzy: number
  exploded: number
  shakes: number[]
  health: number
  hurt: number
  sinceDamage: number
  context: number | undefined
  bumpCooldown: number
  fleeCooldown: number
  approachCooldown: number
  nearPointer: number
  yawn: number
  pet: number
  doneAt: number
  highFiveWith: Blob | null
  highFiveTimer: number
  tomb: Tomb | null
  shiny: boolean
  twinkle: number
  demo: number
}

export interface Tomb {
  x: number
  y: number
  perch: Element | null
  alpha: number
}

export enum ParticleKind {
  Spark = 'spark',
  Snore = 'snore',
  Heart = 'heart',
  Drop = 'drop',
  Stain = 'stain',
  Hole = 'hole',
  Twinkle = 'twinkle',
  Nova = 'nova',
}

export interface Particle {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  hue: number
  size: number
  spots?: [number, number, number][]
  lifetime?: number
}

export interface Pointer {
  x: number
  y: number
  history: { x: number; y: number; t: number }[]
}

export interface Basket {
  x: number
  y: number
  radius: number
  scale: number
  hover: boolean
  pressed: boolean
  color: string
}

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  resting: boolean
  perch: Element | null
  held: boolean
  fetcher: Blob | null
  carried: boolean
  returned: boolean
  idle: number
  alpha: number
  scale: number
  appear: number
  vanishing: boolean
  vanish: number
}

export interface World {
  blobs: Blob[]
  ball: Ball | null
  particles: Particle[]
  perches: Perch[]
  pointer: Pointer
  basket: Basket
  dragged: Blob | null
  hovered: Blob | null
  size: number
  speed: number
  gore: boolean
  sniper: boolean
  recoil: number
  flash: number
  pointerSpeed: number
  sleepAfter: number
  clock: number
  basketClicks: number[]
  width: number
  height: number
}

export const createWorld = (size: number, speed: number, gore: boolean): World => ({
  blobs: [],
  ball: null,
  particles: [],
  perches: [],
  pointer: { x: -1, y: -1, history: [] },
  basket: { x: 0, y: 0, radius: 9, scale: 1, hover: false, pressed: false, color: '#ffffff' },
  dragged: null,
  hovered: null,
  size,
  speed,
  gore,
  sniper: false,
  recoil: 0,
  flash: 0,
  pointerSpeed: 0,
  sleepAfter: SLEEP_AFTER_S,
  clock: 0,
  basketClicks: [],
  width: innerWidth,
  height: innerHeight,
})

export const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min)

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]

export const lerp = (from: number, to: number, ratio: number): number => from + (to - from) * ratio

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

export const hashOf = (text: string): number => [...text].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7)

export const createBlob = (world: World, key: string, paneId: string, hue: number, parent: Blob | null): Blob => {
  const x = parent ? parent.x : randomBetween(world.width * 0.25, world.width * 0.75)
  return {
    key,
    paneId,
    name: '',
    hue,
    radius: world.size * (parent ? CHILD_SCALE : 1),
    contextScale: 1,
    x,
    y: parent ? parent.y - parent.radius : world.height * 0.4,
    vx: parent ? pick([-1, 1]) * randomBetween(160, 260) : 0,
    vy: parent ? -700 : 0,
    perch: null,
    parent,
    children: [],
    mood: parent ? BlobMood.Working : BlobMood.Idle,
    reported: null,
    moodTime: 0,
    idleTime: 0,
    targetX: x,
    tool: '',
    squash: 0,
    squashVelocity: 0,
    grow: 0,
    leaving: false,
    stored: parent?.stored ?? false,
    blink: 1,
    nextBlink: randomBetween(1, 4),
    lookX: 0,
    lookY: 0,
    clock: Math.random() * 100,
    shape: parent ? parent.shape : SHAPE_ORDER[hashOf(paneId) % SHAPE_ORDER.length],
    poke: 0,
    shake: 0,
    errorMix: 0,
    hopTimer: 0,
    dizzy: 0,
    exploded: 0,
    shakes: [],
    health: 1,
    hurt: 0,
    sinceDamage: 0,
    context: undefined,
    bumpCooldown: 0,
    fleeCooldown: 0,
    approachCooldown: 0,
    nearPointer: 0,
    yawn: 0,
    pet: 0,
    doneAt: -Infinity,
    highFiveWith: null,
    highFiveTimer: 0,
    tomb: null,
    shiny: false,
    twinkle: 0,
    demo: 0,
  }
}

export const jump = (world: World, blob: Blob, power: number): void => {
  if (!blob.perch || blob === world.dragged || blob.stored) {
    return
  }
  blob.squash = 0.28
  blob.vy = -power
  blob.perch = null
}

export const impulse = (blob: Blob, amount: number): void => {
  blob.squashVelocity += amount
}

export const burst = (world: World, blob: Blob, count: number): void => {
  for (let index = 0; index < count; index++) {
    const angle = randomBetween(-Math.PI, 0)
    const speed = randomBetween(180, 520)
    world.particles.push({ kind: ParticleKind.Spark, x: blob.x, y: blob.y - blob.radius, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, hue: blob.hue + randomBetween(-40, 40), size: randomBetween(2, 5) })
  }
}

export const setMood = (world: World, blob: Blob, mood: BlobMood): void => {
  if (blob.mood === mood) {
    return
  }
  blob.mood = mood
  blob.moodTime = 0
  blob.idleTime = 0
  blob.targetX = blob.x
  if (mood === BlobMood.Done) {
    blob.doneAt = world.clock
    jump(world, blob, 900)
    burst(world, blob, 26)
  }
  if (mood === BlobMood.Waiting) {
    jump(world, blob, 420)
  }
  if (mood === BlobMood.Error) {
    blob.shake = 1
  }
}

export const removeBlob = (world: World, blob: Blob): void => {
  world.blobs = world.blobs.filter((candidate) => candidate !== blob && candidate.parent !== blob)
  if (blob.parent) {
    blob.parent.children = blob.parent.children.filter((child) => child !== blob)
  }
  if (world.dragged === blob) {
    world.dragged = null
  }
  if (world.hovered === blob) {
    world.hovered = null
  }
}

export const targetRadius = (world: World, blob: Blob): number => world.size * (blob.parent ? CHILD_SCALE : blob.contextScale)

export const contextScaleOf = (tokens: number | undefined): number => {
  if (tokens === undefined) {
    return 1
  }
  return tokens <= NORMAL_CONTEXT
    ? EMPTY_CONTEXT_SCALE + (1 - EMPTY_CONTEXT_SCALE) * (tokens / NORMAL_CONTEXT)
    : Math.min(MAX_CONTEXT_SCALE, 1 + (MAX_CONTEXT_SCALE - 1) * ((tokens - NORMAL_CONTEXT) / (LARGE_CONTEXT - NORMAL_CONTEXT)))
}

export const resize = (world: World): void => {
  world.blobs.forEach((blob) => {
    blob.radius = targetRadius(world, blob)
  })
}
