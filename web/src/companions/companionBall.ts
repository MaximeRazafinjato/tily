import { BlobMood, clamp, GRAVITY, impulse, jump, randomBetween, type Ball, type Blob, type Perch, type World } from './blobModel'

const BALL_RADIUS = 9
const GRAB_MARGIN = 6
const BOUNCE = 0.55
const WALL_BOUNCE = 0.7
const REST_SPEED = 90
const FLOOR_FRICTION = 3
const LIFE_S = 30
const FADE_S = 2
const HOP_COOLDOWN_S = 0.3
const PICKUP_REACH = 0.7
const DELIVERY_REACH = 1.5
const APPEAR_S = 0.35
const VANISH_S = 0.25

const easeOutBack = (progress: number): number => 1 + 2.7 * (progress - 1) ** 3 + 1.7 * (progress - 1) ** 2

export const spawnBall = (world: World): void => {
  world.ball = {
    x: world.basket.x,
    y: world.basket.y,
    vx: randomBetween(150, 320),
    vy: randomBetween(-900, -650),
    radius: BALL_RADIUS,
    resting: false,
    perch: null,
    held: false,
    fetcher: null,
    carried: false,
    returned: false,
    idle: 0,
    alpha: 0,
    scale: 0,
    appear: 0,
    vanishing: false,
    vanish: 1,
  }
}

export const vanishBall = (world: World): void => {
  if (world.ball) {
    world.ball.vanishing = true
    world.ball.held = false
  }
}

export const ballAt = (world: World, x: number, y: number): boolean =>
  world.ball !== null && !world.ball.vanishing && Math.hypot(x - world.ball.x, y - world.ball.y) < world.ball.radius + GRAB_MARGIN

export const grabBall = (ball: Ball): void => {
  ball.held = true
  ball.resting = false
  ball.fetcher = null
  ball.carried = false
  ball.returned = false
  ball.idle = 0
}

export const releaseBall = (ball: Ball, vx: number, vy: number): void => {
  ball.held = false
  ball.vx = vx
  ball.vy = vy
  ball.idle = 0
}

const perchOf = (world: World, element: Element | null): Perch | undefined => world.perches.find((perch) => perch.element === element)

const fall = (world: World, ball: Ball, dt: number): void => {
  const previousBottom = ball.y + ball.radius
  ball.vy += GRAVITY * dt
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt
  if (ball.x < ball.radius || ball.x > world.width - ball.radius) {
    ball.x = clamp(ball.x, ball.radius, world.width - ball.radius)
    ball.vx *= -WALL_BOUNCE
  }
  if (ball.y < ball.radius) {
    ball.y = ball.radius
    ball.vy = Math.abs(ball.vy) * BOUNCE
  }
  const bottom = ball.y + ball.radius
  const landing = world.perches
    .filter((perch) => ball.x >= perch.x1 && ball.x <= perch.x2 && perch.y >= previousBottom - 0.5 && perch.y <= bottom)
    .sort((a, b) => a.y - b.y)[0]
  if (!landing) {
    return
  }
  ball.y = landing.y - ball.radius
  if (ball.vy < REST_SPEED) {
    ball.vy = 0
    ball.resting = true
    ball.perch = landing.element
    return
  }
  ball.vy = -ball.vy * BOUNCE
}

const roll = (world: World, ball: Ball, dt: number): void => {
  const perch = perchOf(world, ball.perch)
  if (!perch || ball.x < perch.x1 || ball.x > perch.x2) {
    ball.resting = false
    return
  }
  ball.y = perch.y - ball.radius
  ball.vx *= Math.exp(-FLOOR_FRICTION * dt)
  ball.x = clamp(ball.x + ball.vx * dt, ball.radius, world.width - ball.radius)
  if (Math.abs(ball.vx) < 5) {
    ball.vx = 0
  }
}

const canFetch = (world: World, blob: Blob): boolean =>
  !blob.stored && !blob.leaving && blob.exploded === 0 && blob !== world.dragged && blob.grow >= 1 && blob.mood === BlobMood.Idle

const nearestFetcher = (world: World, ball: Ball): Blob | null =>
  world.blobs
    .filter((blob) => canFetch(world, blob) && blob.perch !== null && blob.perch === ball.perch)
    .sort((a, b) => Math.abs(a.x - ball.x) - Math.abs(b.x - ball.x))[0] ?? null

const deliveryX = (world: World, ball: Ball, fetcher: Blob): number => {
  const perch = perchOf(world, ball.perch)
  const wanted = world.pointer.x >= 0 ? world.pointer.x : world.basket.x
  return perch ? clamp(wanted, perch.x1 + fetcher.radius, perch.x2 - fetcher.radius) : fetcher.x
}

const chase = (world: World, ball: Ball): void => {
  if (ball.fetcher && !canFetch(world, ball.fetcher)) {
    ball.fetcher = null
    ball.carried = false
  }
  if (!ball.fetcher && ball.resting && !ball.returned) {
    ball.fetcher = nearestFetcher(world, ball)
  }
  const fetcher = ball.fetcher
  if (!fetcher) {
    return
  }
  fetcher.idleTime = 0
  const distance = (ball.carried ? deliveryX(world, ball, fetcher) : ball.x) - fetcher.x
  if (Math.abs(distance) < fetcher.radius * (ball.carried ? DELIVERY_REACH : PICKUP_REACH)) {
    if (ball.carried) {
      ball.carried = false
      ball.fetcher = null
      ball.returned = true
      ball.vx = Math.sign(distance || 1) * 60
      ball.vy = -260
      impulse(fetcher, 6)
    } else {
      ball.carried = true
      ball.resting = false
    }
    fetcher.poke = 0.8
    return
  }
  if (fetcher.approachCooldown <= 0) {
    fetcher.vx = Math.sign(distance) * randomBetween(180, 240)
    fetcher.approachCooldown = HOP_COOLDOWN_S
    jump(world, fetcher, 210)
  }
}

export const updateBall = (world: World, dt: number): void => {
  const { ball } = world
  if (!ball) {
    return
  }
  ball.idle += dt
  ball.appear = Math.min(1, ball.appear + dt / APPEAR_S)
  if (ball.vanishing) {
    ball.vanish -= dt / VANISH_S
    ball.scale = Math.max(0, ball.vanish)
    ball.alpha = Math.max(0, ball.vanish)
    if (ball.vanish <= 0) {
      world.ball = null
    }
    return
  }
  ball.scale = easeOutBack(ball.appear)
  ball.alpha = clamp((LIFE_S - ball.idle) / FADE_S, 0, 1) * Math.min(1, ball.appear * 2)
  if (ball.idle >= LIFE_S) {
    world.ball = null
    return
  }
  if (ball.held) {
    ball.x = world.pointer.x
    ball.y = world.pointer.y
    return
  }
  if (ball.carried && ball.fetcher) {
    ball.x = ball.fetcher.x
    ball.y = ball.fetcher.y - ball.fetcher.radius * 2 - ball.radius * 0.4
    chase(world, ball)
    return
  }
  if (ball.resting) {
    roll(world, ball, dt)
  } else {
    fall(world, ball, dt)
  }
  chase(world, ball)
}
