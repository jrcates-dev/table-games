import { bestThrow, type Throw } from './sim'

/**
 * Throws, simulated before they are needed.
 *
 * A throw takes a few milliseconds per candidate to simulate, and choosing a
 * good one means trying several — cheap, but not free on the frame the player
 * presses Roll. So a small pool is kept topped up in idle time and each roll
 * takes one. Every throw is used once; the pool refills behind it.
 */
const POOL_SIZE = 5
const pool: Throw[] = []
let filling = false
let seed = (Math.random() * 0xffffffff) >>> 0

type IdleHandle = number
const idle: (cb: () => void) => IdleHandle =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 800 })
    : (cb) => window.setTimeout(cb, 60)

function next(): Throw {
  seed = (seed + 0x9e3779b9) >>> 0
  return bestThrow(seed, 8)
}

/** Keep the pool full, one throw per idle slice. */
export function fillPool() {
  if (filling || pool.length >= POOL_SIZE) return
  filling = true
  idle(() => {
    pool.push(next())
    filling = false
    fillPool()
  })
}

/** A throw ready to play — from the pool if one is waiting, simulated now if not. */
export function takeThrow(): Throw {
  const t = pool.shift() ?? next()
  fillPool()
  return t
}
