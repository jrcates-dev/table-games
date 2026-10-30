import * as CANNON from 'cannon-es'
import { DICE } from '../layout'
import { faceUp, type Q4 } from './faces'

/**
 * A real throw, simulated ahead of time.
 *
 * The engine has already decided the numbers; this decides only how the dice
 * get there. Two rigid cubes are thrown down the table in a small physics
 * world — felt underfoot, rubber walls all round — and stepped until they come
 * to rest. The whole trajectory is recorded, along with every collision (which
 * is what the sound of the throw is made from), so playback is just reading
 * frames back. Which face the simulation happened to leave on top does not
 * matter: the drawn dice are re-labelled afterwards so the engine's result is
 * what shows.
 *
 * Units: one die is one unit; `DICE.scale` plane pixels per unit. The plane's
 * x is the simulation's x, the plane's y (toward the player) is z, and height
 * off the felt is y.
 */

export interface Impact {
  /** Seconds after release. */
  t: number
  surface: 'felt' | 'wall' | 'die'
  strength: number
  /** Plane x of the impact, for stereo placement. */
  x: number
}

export interface Throw {
  /** Seconds of simulated time the recorded frames cover. */
  duration: number
  /** Frame rate of the recording. */
  fps: number
  /** Per frame, per die: x, y, z, qx, qy, qz, qw. */
  frames: Float32Array
  frameCount: number
  impacts: Impact[]
  /** Which face each simulated die finished showing. */
  landed: [number, number]
  /** Final resting positions, plane pixels. */
  rest: Array<{ x: number; y: number }>
}

const DT = 1 / 180
const FPS = 60
const RECORD_EVERY = Math.round(1 / (DT * FPS))
const MAX_SECONDS = 4.2
const GRAVITY = 64
const HALF = 0.5

type Rand = () => number

function mulberry(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const S = DICE.scale
const W = {
  x0: DICE.walls.x0 / S,
  x1: DICE.walls.x1 / S,
  z0: DICE.walls.y0 / S,
  z1: DICE.walls.y1 / S,
}

function wall(world: CANNON.World, material: CANNON.Material, position: CANNON.Vec3, euler: [number, number, number], kind: string) {
  const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material })
  body.position.copy(position)
  body.quaternion.setFromEuler(euler[0], euler[1], euler[2])
  ;(body as unknown as { kind: string }).kind = kind
  world.addBody(body)
}

/** One candidate throw from a seed, sent `lane` plane pixels nearer the shooter (see `DICE.lanes`). */
export function simulate(seed: number, lane = 0): Throw {
  const rand = mulberry(seed)
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0) })
  world.allowSleep = false
  ;(world.solver as CANNON.GSSolver).iterations = 12

  const diceMat = new CANNON.Material('dice')
  const feltMat = new CANNON.Material('felt')
  const wallMat = new CANNON.Material('wall')
  world.addContactMaterial(new CANNON.ContactMaterial(diceMat, feltMat, { friction: 0.32, restitution: 0.3 }))
  world.addContactMaterial(new CANNON.ContactMaterial(diceMat, wallMat, { friction: 0.12, restitution: 0.6 }))
  world.addContactMaterial(new CANNON.ContactMaterial(diceMat, diceMat, { friction: 0.18, restitution: 0.45 }))

  wall(world, feltMat, new CANNON.Vec3(0, 0, 0), [-Math.PI / 2, 0, 0], 'felt')
  wall(world, wallMat, new CANNON.Vec3(W.x0, 0, 0), [0, Math.PI / 2, 0], 'wall')
  wall(world, wallMat, new CANNON.Vec3(W.x1, 0, 0), [0, -Math.PI / 2, 0], 'wall')
  wall(world, wallMat, new CANNON.Vec3(0, 0, W.z0), [0, 0, 0], 'wall')
  wall(world, wallMat, new CANNON.Vec3(0, 0, W.z1), [0, Math.PI, 0], 'wall')

  const start = { x: DICE.release.x / S, y: DICE.release.h / S, z: DICE.release.y / S }
  // Lofted at a point on the back wall behind the far end, or the lane's end:
  // most of the way in the air, a bounce or two on the felt, then off the
  // rubber and back — the way a legal throw has to go.
  const aimX = (DICE.aim.x0 - lane + rand() * (DICE.aim.x1 - DICE.aim.x0)) / S
  const heading = Math.atan2(W.z0 - start.z, aimX - start.x)
  const speed = 29 + rand() * 6
  const bodies = [0, 1].map((i) => {
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(HALF, HALF, HALF)),
      material: diceMat,
      linearDamping: 0.08,
      angularDamping: 0.12,
    })
    body.position.set(start.x + i * 1.25 + rand() * 0.3, start.y + rand() * 0.6, start.z - i * 0.4 + rand() * 0.3)
    body.quaternion.setFromEuler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2)
    const s = speed * (0.95 + rand() * 0.1)
    const h = heading + (rand() - 0.5) * 0.08
    body.velocity.set(Math.cos(h) * s, 16 + rand() * 5, Math.sin(h) * s)
    body.angularVelocity.set((rand() - 0.5) * 50, (rand() - 0.5) * 50, (rand() - 0.5) * 50)
    ;(body as unknown as { kind: string }).kind = 'die'
    world.addBody(body)
    return body
  })

  const impacts: Impact[] = []
  const lastHit = new Map<string, number>()
  let time = 0
  bodies.forEach((body, i) => {
    body.addEventListener('collide', (event: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
      const other = event.body as unknown as { kind: string; id: number }
      const surface = other.kind === 'die' ? 'die' : other.kind === 'wall' ? 'wall' : 'felt'
      // Die-on-die is reported by both dice; hear it once.
      if (surface === 'die' && i === 1) return
      const speedIn = Math.abs(event.contact.getImpactVelocityAlongNormal())
      if (speedIn < 0.9) return
      const key = `${i}:${other.id}`
      const last = lastHit.get(key) ?? -1
      if (time - last < 0.035) return
      lastHit.set(key, time)
      impacts.push({ t: time, surface, strength: Math.min(1, speedIn / 22), x: body.position.x * S })
    })
  })

  const frames: number[] = []
  const record = () => {
    for (const body of bodies) {
      frames.push(body.position.x, body.position.y, body.position.z, body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
    }
  }

  record()
  let still = 0
  let step = 0
  while (time < MAX_SECONDS) {
    world.step(DT)
    time += DT
    step++
    if (step % RECORD_EVERY === 0) record()
    const resting = bodies.every((b) => b.velocity.length() < 0.06 && b.angularVelocity.length() < 0.12 && b.position.y < HALF + 0.05)
    still = resting ? still + 1 : 0
    // A quarter of a second of stillness is at rest.
    if (still > 45) break
  }
  record()

  const q = (b: CANNON.Body): Q4 => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]
  return {
    duration: time,
    fps: FPS,
    frames: Float32Array.from(frames),
    frameCount: frames.length / 14,
    impacts,
    landed: [faceUp(q(bodies[0])), faceUp(q(bodies[1]))],
    rest: bodies.map((b) => ({ x: b.position.x * S, y: b.position.z * S })),
  }
}

/** How well a throw finished: in its lane's landing zone, apart, flat, in good time. */
function score(t: Throw, lane: number): number {
  const z = DICE.zone
  let s = 0
  for (const r of t.rest) {
    const dx = Math.max(z.x0 - lane - r.x, 0, r.x - z.x1 + lane)
    const dy = Math.max(z.y0 - r.y, 0, r.y - z.y1)
    s += dx + dy
  }
  const [a, b] = t.rest
  const apart = Math.hypot(a.x - b.x, a.y - b.y) / S
  if (apart < 1.3) s += (1.3 - apart) * 200
  // Real dice finish near each other; a pair at opposite ends looks thrown apart.
  if (apart > 7) s += (apart - 7) * 40
  if (t.duration > 3.2) s += (t.duration - 3.2) * 300
  if (t.duration < 1.2) s += (1.2 - t.duration) * 300
  if (!t.impacts.some((i) => i.surface === 'wall')) s += 400
  return s
}

/** Throw a few candidates and keep the best — or the first that is good enough. */
export function bestThrow(seed: number, budget = 6, lane = 0): Throw {
  let best: Throw | null = null
  let bestScore = Infinity
  for (let i = 0; i < budget; i++) {
    const candidate = simulate((seed + i * 7919) >>> 0, lane)
    const s = score(candidate, lane)
    if (s < bestScore) {
      best = candidate
      bestScore = s
    }
    if (s === 0) break
  }
  return best!
}
