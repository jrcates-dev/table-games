import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { diceHit, play } from '../../audio'
import { useStageScale } from '../../components/stageScale'
import { useEffectsLevel } from '../../lib/effects'
import type { Roll } from '../../engine/craps/types'
import { ROLL_DURATION, useCrapsStore } from '../../store/crapsStore'
import { CAMERA, DICE, PLANE, STAGE } from '../layout'
import { axisAngle, FACE_NORMAL, multiply, relabel, type Q4 } from './faces'
import { fillPool, takeThrow } from './bank'
import type { Throw } from './sim'

/**
 * The dice, in WebGL, over the CSS table.
 *
 * The felt is DOM — crisp text, real hit-testing — and the dice are three.js,
 * because a translucent acetate cube catching the light is the one thing on
 * the table CSS cannot draw. The two agree on space exactly: the camera here is
 * built from the same perspective distance, tilt and plane position the CSS
 * uses, so a die resting at a point on the felt is drawn over that point.
 */

const FOV = (2 * Math.atan(STAGE.h / 2 / CAMERA.perspective) * 180) / Math.PI
const TILT = (CAMERA.tilt * Math.PI) / 180

/**
 * What the dice cost to draw. Full softens the shadow with a blurred variance
 * map at 2048 and coats the acetate with sheen; lighter takes the GPU's
 * built-in soft shadow from a map a quarter the size, drops the sheen and
 * draws at no more than 1.75 pixels per point — the same dice, at a fraction of
 * the fill rate an older phone has to spare.
 */
const QUALITY = {
  full: { shadow: THREE.VSMShadowMap, mapSize: 2048, maxDpr: 2.5, sheen: 0.3 },
  reduced: { shadow: THREE.PCFSoftShadowMap, mapSize: 1024, maxDpr: 1.75, sheen: 0 },
} as const

type Quality = (typeof QUALITY)[keyof typeof QUALITY]

export function DiceOverlay() {
  const scale = useStageScale()
  const level = useEffectsLevel()
  const quality = QUALITY[level]
  const dpr = Math.min(quality.maxDpr, Math.max(1, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) * scale))

  useEffect(() => fillPool(), [])

  return (
    <div className="cr-dice" aria-hidden="true">
      {/* A new level means new shaders and a new shadow map: start the canvas afresh. */}
      <Canvas
        key={level}
        dpr={dpr}
        resize={{ offsetSize: true }}
        shadows={{ type: quality.shadow }}
        frameloop="demand"
        gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ fov: FOV, position: [0, 0, CAMERA.perspective], near: 10, far: 20000 }}
      >
        <DiceScene quality={quality} />
      </Canvas>
    </div>
  )
}

// ---------------------------------------------------------------------------

interface Playback {
  throw: Throw | null
  start: number
  windup: number
  speedup: number
  remap: [Q4, Q4]
  /** For instant rolls and the idle pose: where each die simply sits. */
  rest?: Array<{ x: number; y: number; q: Q4 }>
  drop?: number
}

const S = DICE.scale
const HAND = { x: 520 / S, y: 150 / S, z: 990 / S }
const SPIN_AXIS = new THREE.Vector3(1, 0.3, 0.2).normalize()

function toSim(x: number, y: number): [number, number] {
  return [x / S, y / S]
}

/** A die lying flat with `value` up, turned `yaw` about the vertical. */
function restingWith(value: number, yaw: number): Q4 {
  return multiply(axisAngle([0, 1, 0], yaw), relabel(value, 1))
}

function idlePose(roll: Roll | null): Array<{ x: number; y: number; q: Q4 }> {
  const a = roll?.a ?? 5
  const b = roll?.b ?? 2
  return [
    { x: 1330, y: 360, q: restingWith(a, 0.4) },
    { x: 1398, y: 392, q: restingWith(b, -0.3) },
  ]
}

function panFor(x: number): number {
  return Math.max(-0.8, Math.min(0.8, (x / PLANE.w) * 1.6 - 0.8))
}

function DiceScene({ quality }: { quality: Quality }) {
  const roll = useCrapsStore((s) => s.game.roll)
  const seq = useCrapsStore((s) => s.game.seq)
  const rolling = useCrapsStore((s) => s.game.phase === 'rolling')
  const speed = useCrapsStore((s) => s.profile.settings.rollSpeed)
  const invalidate = useThree((s) => s.invalidate)
  const dice = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const shadows = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]
  const playback = useRef<Playback>({
    throw: null,
    start: 0,
    windup: 0,
    speedup: 1,
    remap: [[0, 0, 0, 1], [0, 0, 0, 1]],
    rest: idlePose(roll),
  })

  // A new throw each time the dice leave the shooter's hand.
  useEffect(() => {
    if (!rolling || !roll) return
    const total = ROLL_DURATION[speed] / 1000
    const now = performance.now() / 1000
    let until = now + total + 0.3

    if (speed === 'instant') {
      playback.current = {
        throw: null,
        start: now,
        windup: 0,
        speedup: 1,
        remap: [[0, 0, 0, 1], [0, 0, 0, 1]],
        rest: [
          { x: 1300 + Math.random() * 60, y: 330 + Math.random() * 40, q: restingWith(roll.a, Math.random() * 6) },
          { x: 1392 + Math.random() * 60, y: 360 + Math.random() * 60, q: restingWith(roll.b, Math.random() * 6) },
        ],
        drop: 0.16,
      }
      diceHit('felt', 0.6, 0.14)
      diceHit('die', 0.4, 0.17)
    } else {
      const t = takeThrow()
      const windup = Math.min(0.3, total * 0.14)
      // The last quarter second of a simulation is the dice sitting still.
      const moving = Math.max(0.5, t.duration - 0.25)
      const speedup = Math.max(0.85, moving / Math.max(0.4, total - windup - 0.15))
      playback.current = {
        throw: t,
        start: now,
        windup,
        speedup,
        remap: [relabel(roll.a, t.landed[0]), relabel(roll.b, t.landed[1])],
      }
      play('diceShake')
      play('diceRelease', { at: Math.max(0, windup - 0.08) })
      for (const impact of t.impacts) {
        const at = windup + impact.t / speedup
        if (at > total + 0.4) continue
        diceHit(impact.surface, impact.strength, at, panFor(impact.x))
      }
      until = now + windup + t.duration / speedup + 0.2
    }

    let frame = 0
    const loop = () => {
      invalidate()
      if (performance.now() / 1000 < until) frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
    // A throw starts exactly when a new roll does; the roll and the speed are
    // read at that moment, and a change to either mid-throw must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, rolling])

  // Coming back to the table, or loading it: the dice show the last roll.
  useEffect(() => {
    if (!rolling && !playback.current.throw && !playback.current.drop) {
      playback.current.rest = idlePose(roll)
      invalidate()
    }
  }, [roll, rolling, invalidate])

  const q = useMemo(() => new THREE.Quaternion(), [])
  const q1 = useMemo(() => new THREE.Quaternion(), [])
  const r = useMemo(() => new THREE.Quaternion(), [])

  /**
   * A soft pool of shade under each die, tracking it across the felt and
   * spreading and fading as it rises — the contact shadow that makes a resting
   * die sit on the cloth rather than float over it.
   */
  const ground = () => {
    for (let k = 0; k < 2; k++) {
      const die = dice[k].current
      const shade = shadows[k].current
      if (!die || !shade) continue
      const lift = Math.max(0, die.position.y - 0.5)
      shade.position.set(die.position.x + lift * 0.18, 0.02, die.position.z - lift * 0.3)
      shade.scale.setScalar(2 + lift * 0.5)
      ;(shade.material as THREE.MeshBasicMaterial).opacity = 0.72 * Math.max(0.15, 1 - lift / 3.5)
    }
  }

  useFrame(() => {
    const p = playback.current
    const now = performance.now() / 1000
    const elapsed = now - p.start

    if (!p.throw) {
      const rest = p.rest ?? idlePose(roll)
      rest.forEach((pose, k) => {
        const die = dice[k].current
        if (!die) return
        const [x, z] = toSim(pose.x, pose.y)
        const fall = p.drop ? Math.max(0, 1 - elapsed / p.drop) : 0
        die.position.set(x, 0.5 + fall * fall * 2.2, z)
        die.quaternion.set(pose.q[0], pose.q[1], pose.q[2], pose.q[3])
      })
      ground()
      return
    }

    const t = p.throw
    const f = t.frames
    const stride = 7
    for (let k = 0; k < 2; k++) {
      const die = dice[k].current
      if (!die) continue
      const base = (i: number) => i * 14 + k * stride

      if (elapsed < p.windup) {
        // Out of the shooter's hand and into the start of the throw.
        const u = elapsed / p.windup
        const e = u * u
        const o = base(0)
        die.position.set(
          HAND.x + (f[o] - HAND.x) * e + k * 0.9 * (1 - e),
          HAND.y + (f[o + 1] - HAND.y) * e,
          HAND.z + (f[o + 2] - HAND.z) * e,
        )
        q.set(f[o + 3], f[o + 4], f[o + 5], f[o + 6])
        // Spinning in the hand, winding down to exactly the throw's first frame.
        q1.setFromAxisAngle(SPIN_AXIS, (1 - u) * (5 + k))
        q.premultiply(q1)
      } else {
        const simT = Math.min(t.duration, (elapsed - p.windup) * p.speedup)
        const pos = Math.min(t.frameCount - 1, simT * t.fps)
        const i0 = Math.floor(pos)
        const i1 = Math.min(t.frameCount - 1, i0 + 1)
        const a = pos - i0
        const o0 = base(i0)
        const o1 = base(i1)
        die.position.set(f[o0] + (f[o1] - f[o0]) * a, f[o0 + 1] + (f[o1 + 1] - f[o0 + 1]) * a, f[o0 + 2] + (f[o1 + 2] - f[o0 + 2]) * a)
        q.set(f[o0 + 3], f[o0 + 4], f[o0 + 5], f[o0 + 6])
        q1.set(f[o1 + 3], f[o1 + 4], f[o1 + 5], f[o1 + 6])
        q.slerp(q1, a)
      }
      const m = p.remap[k]
      r.set(m[0], m[1], m[2], m[3])
      die.quaternion.copy(q).multiply(r)
    }
    ground()
  })

  const target = useMemo(() => new THREE.Object3D(), [])
  useRoomLight()

  return (
    <>
      <ambientLight intensity={0.55} color="#ffe7c7" />

      {/* The tilted plane, placed exactly where the CSS puts the felt. */}
      <group position={[CAMERA.cx - STAGE.w / 2, -(CAMERA.cy - STAGE.h / 2), CAMERA.z]} rotation={[Math.PI / 2 - TILT, 0, 0]}>
        <primitive object={target} position={[360, 0, -80]} />
        <directionalLight
          position={[120, 1500, 520]}
          target={target}
          intensity={2.1}
          color="#fff0d8"
          castShadow
          shadow-mapSize={[quality.mapSize, quality.mapSize]}
          shadow-radius={9}
          shadow-blurSamples={16}
          shadow-bias={-0.0004}
          shadow-camera-left={-1150}
          shadow-camera-right={1150}
          shadow-camera-top={700}
          shadow-camera-bottom={-700}
          shadow-camera-near={200}
          shadow-camera-far={3600}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]} receiveShadow>
          <planeGeometry args={[PLANE.w, PLANE.h]} />
          <shadowMaterial transparent opacity={0.5} />
        </mesh>

        {/* Simulation space: one unit is one die, origin at the plane's corner. */}
        <group position={[-PLANE.w / 2, 0, -PLANE.h / 2]} scale={S}>
          <ContactShadow ref={shadows[0]} />
          <ContactShadow ref={shadows[1]} />
          <Die ref={dice[0]} sheen={quality.sheen} />
          <Die ref={dice[1]} sheen={quality.sheen} />
        </group>
      </group>
    </>
  )
}

// ---------------------------------------------------------------------------

/**
 * What the dice reflect: the room's lights, as a handful of glowing panels
 * baked once into an environment map — a warm pendant overhead, a warmer lamp
 * to one side, a cool wash from the far end of the floor. It is what gives the
 * acetate its highlights; direct light alone leaves it looking like plastic.
 */
function useRoomLight() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const room = new THREE.Scene()
    const panel = (w: number, h: number, color: string, intensity: number, position: [number, number, number]) => {
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
      mesh.position.set(...position)
      mesh.lookAt(0, 0, 0)
      room.add(mesh)
    }
    panel(5, 5, '#fff3dc', 1.8, [0, 6, 0.01])
    panel(2.5, 2.5, '#ffd79c', 3.4, [-3, 4, 3])
    panel(5, 2, '#a8c6ff', 1.4, [5, 2, -4])
    panel(3, 3, '#ff9a6a', 0.8, [-5, 1, -2])
    const pmrem = new THREE.PMREMGenerator(gl)
    const map = pmrem.fromScene(room, 0.02).texture
    scene.environment = map
    invalidate()
    return () => {
      scene.environment = null
      map.dispose()
      pmrem.dispose()
      room.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
    }
  }, [gl, scene, invalidate])
}

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
}

let pipGeometry: THREE.BufferGeometry | null = null

/** Every pip of a die in one geometry, sitting a hair proud of each face. */
function pips(): THREE.BufferGeometry {
  if (pipGeometry) return pipGeometry
  const parts: THREE.BufferGeometry[] = []
  const up = new THREE.Vector3(0, 0, 1)
  for (let value = 1; value <= 6; value++) {
    const n = new THREE.Vector3(...FACE_NORMAL[value])
    const u = Math.abs(n.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const w = new THREE.Vector3().crossVectors(n, u)
    const orient = new THREE.Quaternion().setFromUnitVectors(up, n)
    for (const [px, py] of PIPS[value]) {
      const disc = new THREE.CircleGeometry(value === 1 ? 0.12 : 0.085, 24)
      disc.applyQuaternion(orient)
      const at = n.clone().multiplyScalar(0.503).addScaledVector(u, px * 0.26).addScaledVector(w, py * 0.26)
      disc.translate(at.x, at.y, at.z)
      parts.push(disc)
    }
  }
  pipGeometry = mergeGeometries(parts)
  return pipGeometry
}

let shadowTexture: THREE.Texture | null = null

function shadowMap(): THREE.Texture {
  if (shadowTexture) return shadowTexture
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.85)')
  g.addColorStop(0.45, 'rgba(0,0,0,0.45)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  shadowTexture = new THREE.CanvasTexture(canvas)
  return shadowTexture
}

function ContactShadow({ ref }: { ref: React.Ref<THREE.Mesh> }) {
  const map = useMemo(shadowMap, [])
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} opacity={0.6} />
    </mesh>
  )
}

let bodyGeometry: THREE.BufferGeometry | null = null

/** Casino dice have near-razor edges; a small radius keeps them crisp but lit. */
function body(): THREE.BufferGeometry {
  bodyGeometry ??= new RoundedBoxGeometry(1, 1, 1, 4, 0.06)
  return bodyGeometry
}

function Die({ ref, sheen }: { ref: React.Ref<THREE.Group>; sheen: number }) {
  const geometry = useMemo(pips, [])
  const shell = useMemo(body, [])
  return (
    <group ref={ref} position={[39, 0.5, 11]}>
      <mesh geometry={shell} castShadow>
        <meshPhysicalMaterial
          color="#b3071f"
          roughness={0.16}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transparent
          opacity={0.92}
          envMapIntensity={1.3}
          sheen={sheen}
          sheenColor="#ff6b6b"
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#fbf8f2" roughness={0.35} envMapIntensity={0.6} />
      </mesh>
    </group>
  )
}
