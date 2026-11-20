import { impulse, randomBetween, type Blob, type World } from './blobModel'

const HOVER_MARGIN = 14
const HOVER_SCALE = 3.2
const CORNER_OFFSET = 22

export const placeBasket = (world: World, anchor: Element | null): void => {
  const rect = anchor?.getBoundingClientRect()
  world.basket.x = (rect?.left ?? 0) + CORNER_OFFSET
  world.basket.y = (rect?.bottom ?? world.height) - CORNER_OFFSET
}

export const insideBasket = (world: World, x: number, y: number): boolean =>
  Math.hypot(x - world.basket.x, y - world.basket.y) < world.basket.radius * world.basket.scale + HOVER_MARGIN

export const updateBasket = (world: World): void => {
  const { basket, pointer } = world
  basket.hover = insideBasket(world, pointer.x, pointer.y)
  basket.scale += ((world.dragged && basket.hover ? HOVER_SCALE : 1) - basket.scale) * 0.2
}

export const storeBlob = (blob: Blob): void => {
  ;[blob, ...blob.children].forEach((member) => {
    member.stored = true
    member.perch = null
  })
}

export const releaseStored = (world: World): void => {
  world.blobs
    .filter((blob) => blob.stored)
    .forEach((blob) => {
      blob.stored = false
      blob.x = world.basket.x
      blob.y = world.basket.y
      blob.vx = randomBetween(40, 420)
      blob.vy = randomBetween(-950, -650)
      impulse(blob, -8)
    })
}
