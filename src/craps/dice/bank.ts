import { bestThrow, type Throw } from './sim'

/**
 * Throws, simulated before they are needed.
 *
 * A throw takes a few milliseconds per candidate to simulate, and choosing a
 * good one means trying several — cheap, but not free on the frame the player
 * presses Roll. So a small pool is kept topped up in idle time and each roll
 * takes one. Every throw is used once; the pool refills behind it.
 *
 * Each lane (see `DICE.lanes`) has a pool of its own. The far end's is always
 * kept full, and so is the lane the dice were last needed in — so with the
 * rail or a drawer open, the throws that land clear of it are ready too.
 */
const POOL_SIZE = 5
const pools = new Map<number, Throw[]>()
let current = 0
let filling = false
let seed = (Math.random() * 0xffffffff) >>> 0

type IdleHandle = number
const idle: (cb: () => void) => IdleHandle =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 800 })
    : (cb) => window.setTimeout(cb, 60)

function poolFor(lane: number): Throw[] {
  let pool = pools.get(lane)
  if (!pool) pools.set(lane, (pool = []))
  return pool
}

function next(lane: number): Throw {
  seed = (seed + 0x9e3779b9) >>> 0
  return bestThrow(seed, 8, lane)
}

/** Keep the far end's pool and `lane`'s full, one throw per idle slice. */
export function fillPool(lane = current) {
  current = lane
  if (filling) return
  const short = [current, 0].find((l) => poolFor(l).length < POOL_SIZE)
  if (short === undefined) return
  filling = true
  idle(() => {
    poolFor(short).push(next(short))
    filling = false
    fillPool()
  })
}

/** A throw ready to play in `lane` — from the pool if one is waiting, simulated now if not. */
export function takeThrow(lane = 0): Throw {
  const t = poolFor(lane).shift() ?? next(lane)
  fillPool(lane)
  return t
}
