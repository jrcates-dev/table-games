import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import { pocketColor, pocketLabel, wheelOrder, type Pocket, type WheelType } from '../engine/roulette/wheel'
import { DROP_AT, useRouletteStore } from '../store/rouletteStore'
import { onWheel, PLANE, WHEEL } from './geometry'

/**
 * The wheel head, set into the table.
 *
 * Drawn once as SVG and turned by transform: the head turns anticlockwise all
 * the time, as a real one does between spins, and the ball runs clockwise
 * round the track, drops, rattles across the frets and rides the head round in
 * the pocket the engine already chose. The bowl, the head and the ball are
 * separate layers, so turning the head never repaints the wheel.
 *
 * The ball's path is worked out relative to the head, so however fast the head
 * happens to be turning the ball always finishes in the right pocket.
 */

const RED = '#b51d28'
const BLACK = '#121014'
const GREEN = '#0f7a44'
const FILL = { red: RED, black: BLACK, green: GREEN }

/** Survives leaving the table and coming back, so the wheel is where you left it. */
const memory = { rotor: 0 }

const IDLE_SPEED = 11
const LAUNCH_SPEED = 40

function segment(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = onWheel(a0, r1)
  const [x1, y1] = onWheel(a1, r1)
  const [x2, y2] = onWheel(a1, r0)
  const [x3, y3] = onWheel(a0, r0)
  return `M ${x0} ${y0} A ${r1} ${r1} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 0 0 ${x3} ${y3} Z`
}

const mod = (a: number, m: number) => ((a % m) + m) % m
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3)

interface Flight {
  start: number
  seconds: number
  /** Ball angle relative to the head at launch, and how far it travels. */
  phi0: number
  travel: number
}

/** The head's outer edge: the square the turning layer is cut to. */
const HEAD_R = WHEEL.rotor + 2
const IDLE_MS = (360 / IDLE_SPEED) * 1000

export const Wheel = memo(function Wheel() {
  const wheel = useRouletteStore((s) => s.game.wheel)
  const phase = useRouletteStore((s) => s.game.phase)
  const result = useRouletteStore((s) => s.game.result)
  const seq = useRouletteStore((s) => s.game.seq)
  const spinStartedAt = useRouletteStore((s) => s.spinStartedAt)
  const spinSeconds = useRouletteStore((s) => s.spinSeconds)
  const order = wheelOrder(wheel)
  const step = 360 / order.length

  const rotorRef = useRef<HTMLDivElement>(null)
  const restRef = useRef<SVGGElement>(null)
  const ballRef = useRef<HTMLDivElement>(null)
  const engine = useRef<ReturnType<typeof wheelEngine> | null>(null)

  useLayoutEffect(() => {
    const motor = wheelEngine(rotorRef.current!, ballRef.current!, restRef.current!)
    engine.current = motor
    return () => {
      motor.stop()
      engine.current = null
    }
  }, [])

  // Where the ball lies when it is not in the air.
  useLayoutEffect(() => {
    engine.current?.rest(result === null ? null : order.indexOf(result) * step)
  }, [result, order, step])

  // A new spin: launch the ball from the dealer's side of the track.
  useEffect(() => {
    if (phase !== 'spinning' || result === null) return
    engine.current?.launch(order.indexOf(result) * step, spinStartedAt, spinSeconds)
  }, [phase, seq, result, spinStartedAt, spinSeconds, order, step])

  return (
    <div className="ro-wheel" aria-hidden="true">
      <svg width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`}>
        <defs>
          <radialGradient id="ro-bowl" gradientUnits="userSpaceOnUse" cx={WHEEL.cx - 60} cy={WHEEL.cy - 80} r={WHEEL.bowl * 1.3}>
            <stop offset="0" stopColor="#7a4523" />
            <stop offset="0.55" stopColor="#4b2512" />
            <stop offset="1" stopColor="#1f0e06" />
          </radialGradient>
          <radialGradient id="ro-track" gradientUnits="userSpaceOnUse" cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.bowl}>
            <stop offset="0.8" stopColor="#3a1d0e" />
            <stop offset="0.86" stopColor="#a8714a" />
            <stop offset="0.93" stopColor="#6b3e20" />
            <stop offset="1" stopColor="#2a1408" />
          </radialGradient>
          <radialGradient id="ro-cone" gradientUnits="userSpaceOnUse" cx={WHEEL.cx - 20} cy={WHEEL.cy - 30} r={WHEEL.pockets * 1.2}>
            <stop offset="0" stopColor="#c79055" />
            <stop offset="0.6" stopColor="#7d4a24" />
            <stop offset="1" stopColor="#3d200e" />
          </radialGradient>
          <radialGradient id="ro-ball" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#ece8df" />
            <stop offset="1" stopColor="#a39d92" />
          </radialGradient>
          <radialGradient id="ro-gloss" gradientUnits="userSpaceOnUse" cx={WHEEL.cx - 70} cy={WHEEL.cy - 110} r={WHEEL.bowl}>
            <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <filter id="ro-wheel-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        {/* The cabinet and bowl. */}
        <circle cx={WHEEL.cx + 6} cy={WHEEL.cy + 16} r={WHEEL.bowl + 24} fill="#000" opacity="0.6" filter="url(#ro-wheel-shadow)" />
        <circle cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.bowl + 16} fill="#1a0c05" />
        <circle cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.bowl + 15} fill="none" stroke="url(#gold-foil)" strokeWidth="2.4" />
        <circle cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.bowl} fill="url(#ro-bowl)" />
        <circle cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.bowl} fill="url(#ro-track)" opacity="0.9" />
        <circle cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.track - 12} fill="#24120a" />
        <Deflectors />
      </svg>

      {/* The head: number ring, pockets, cone and turret, and the ball once it
          lies in a pocket, on a layer of their own that turns as a whole. */}
      <div
        ref={rotorRef}
        className="ro-wheel__head"
        style={{ left: WHEEL.cx - HEAD_R, top: WHEEL.cy - HEAD_R, width: HEAD_R * 2, height: HEAD_R * 2 }}
      >
        <svg width={HEAD_R * 2} height={HEAD_R * 2} viewBox={`${WHEEL.cx - HEAD_R} ${WHEEL.cy - HEAD_R} ${HEAD_R * 2} ${HEAD_R * 2}`}>
          <Head order={order} wheel={wheel} />
          <g ref={restRef} visibility="hidden">
            <BallShape />
          </g>
        </svg>
      </div>

      {/* The ball in flight. */}
      <div ref={ballRef} className="ro-wheel__ball">
        <svg width="24" height="24" viewBox="-12 -12 24 24">
          <BallShape />
        </svg>
      </div>

      <svg width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`}>
        <circle cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.bowl} fill="url(#ro-gloss)" />
      </svg>
    </div>
  )
})

function BallShape() {
  return (
    <>
      <ellipse cx="2" cy="4" rx="7" ry="5" fill="#000" opacity="0.35" />
      <circle r="7" fill="url(#ro-ball)" />
    </>
  )
}

/**
 * Turns the head and flies the ball.
 *
 * Between spins the head turns at a steady pace as a compositor animation, so
 * an idle wheel costs the main thread nothing. A spin hands it to a frame loop
 * that runs only while the ball is in the air — the head and ball are each a
 * layer of their own, so a frame moves them without repainting either — and
 * hands it back once the ball has landed.
 */
function wheelEngine(head: HTMLElement, ball: HTMLElement, resting: SVGGElement) {
  let turning: Animation | null = null
  let turnFrom = 0
  let frame = 0
  let last = 0
  let flight: Flight | null = null
  let restAt: number | null = null

  const show = (rotor: number) => {
    head.style.transform = `rotate(${rotor.toFixed(3)}deg)`
  }

  // Take the head back from the steady turn, noting where it had got to.
  const halt = () => {
    if (!turning) return
    const t = Number(turning.currentTime ?? 0)
    memory.rotor = mod(turnFrom - 360 * ((t % IDLE_MS) / IDLE_MS), 360)
    turning.cancel()
    turning = null
    show(memory.rotor)
  }

  const turn = () => {
    halt()
    turnFrom = memory.rotor
    show(turnFrom)
    turning = head.animate([{ transform: `rotate(${turnFrom}deg)` }, { transform: `rotate(${turnFrom - 360}deg)` }], {
      duration: IDLE_MS,
      iterations: Infinity,
    })
  }

  const showResting = () => {
    resting.setAttribute('visibility', restAt !== null && !flight ? 'visible' : 'hidden')
  }

  const tick = (now: number) => {
    const f = flight
    if (!f) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const u = Math.min(1, (Date.now() - f.start) / (f.seconds * 1000))
    const speed = u < 1 ? IDLE_SPEED + (LAUNCH_SPEED - IDLE_SPEED) * (1 - u) * (1 - u) : IDLE_SPEED
    memory.rotor = mod(memory.rotor - speed * dt, 360)
    show(memory.rotor)
    if (u < 1) {
      let angle = memory.rotor + f.phi0 + f.travel * easeOut(u)
      // Hopping between pockets, a few degrees either way, dying out.
      if (u > DROP_AT && u < 0.92) {
        const w = (u - DROP_AT) / (0.92 - DROP_AT)
        angle += 7 * Math.sin(w * Math.PI * 6) * (1 - w) * (1 - w)
      }
      const [x, y] = onWheel(angle, ballRadius(u))
      ball.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`
      frame = requestAnimationFrame(tick)
      return
    }
    // Landed: the ball lies in its pocket and turns with the head.
    flight = null
    frame = 0
    ball.style.visibility = 'hidden'
    showResting()
    turn()
  }

  show(memory.rotor)
  turn()

  return {
    rest(angle: number | null) {
      restAt = angle
      if (angle !== null) {
        const [x, y] = onWheel(angle, WHEEL.rest)
        resting.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
      }
      showResting()
    },
    launch(target: number, start: number, seconds: number) {
      halt()
      const phi0 = 300 - memory.rotor
      const laps = Math.max(2, Math.round(seconds * 0.85))
      flight = { start, seconds, phi0, travel: mod(target - phi0, 360) + 360 * laps }
      showResting()
      ball.style.visibility = 'visible'
      cancelAnimationFrame(frame)
      last = performance.now()
      frame = requestAnimationFrame(tick)
    },
    stop() {
      cancelAnimationFrame(frame)
      frame = 0
      halt()
    },
  }
}

/** Ball distance from the centre over the spin: the track, the drop, the rattle, the pocket. */
function ballRadius(u: number): number {
  const track = WHEEL.track - 4
  if (u < DROP_AT) return track
  const fall = DROP_AT + 0.08
  const high = WHEEL.numbers + 10
  if (u < fall) {
    const w = (u - DROP_AT) / (fall - DROP_AT)
    return track + (high - track) * w * w
  }
  if (u < 0.92) {
    const w = (u - fall) / (0.92 - fall)
    return WHEEL.rest + (high - WHEEL.rest) * Math.abs(Math.cos(w * Math.PI * 3.5)) * Math.pow(1 - w, 1.5)
  }
  return WHEEL.rest
}

/** The eight chrome deflectors on the apron, alternately upright and flat. */
function Deflectors() {
  const r = (WHEEL.rotor + WHEEL.track - 12) / 2 + 2
  return (
    <g>
      {Array.from({ length: 8 }, (_, i) => {
        const angle = i * 45 + 22.5
        const [x, y] = onWheel(angle, r)
        const long = i % 2 === 0
        return (
          <path
            key={i}
            d={long ? 'M 0 -7 L 3.4 0 L 0 7 L -3.4 0 Z' : 'M 0 -4 L 6 0 L 0 4 L -6 0 Z'}
            transform={`translate(${x} ${y}) rotate(${angle})`}
            fill="#e9e3d4"
            stroke="#8d8676"
            strokeWidth="0.8"
          />
        )
      })}
    </g>
  )
}

const Head = memo(function Head({ order, wheel }: { order: readonly Pocket[]; wheel: WheelType }) {
  const step = 360 / order.length
  const labelR = (WHEEL.numbers + WHEEL.rotor) / 2 + 1
  return (
    <g data-wheel={wheel}>
      <circle cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.rotor + 2} fill="#c9a24e" />
      {order.map((pocket, i) => {
        const a0 = (i - 0.5) * step
        const a1 = (i + 0.5) * step
        const colour = FILL[pocketColor(pocket)]
        return (
          <g key={pocket}>
            <path d={segment(WHEEL.numbers, WHEEL.rotor, a0, a1)} fill={colour} stroke="#d8b768" strokeWidth="0.9" />
            <path d={segment(WHEEL.pockets, WHEEL.numbers, a0, a1)} fill={colour} opacity="0.62" />
            <path d={segment(WHEEL.pockets, WHEEL.numbers, a0, a1)} fill="#000" opacity="0.38" stroke="#d9d6cf" strokeWidth="1.1" />
            <text
              x={WHEEL.cx}
              y={WHEEL.cy - labelR}
              transform={`rotate(${i * step} ${WHEEL.cx} ${WHEEL.cy})`}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="Cormorant Garamond, serif"
              fontWeight="700"
              fontSize="15"
              fill="#f6efe0"
              style={{ fontVariantNumeric: 'lining-nums' }}
            >
              {pocketLabel(pocket)}
            </text>
          </g>
        )
      })}
      <circle cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.numbers} fill="none" stroke="#d8b768" strokeWidth="1.4" />
      <circle cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.pockets} fill="url(#ro-cone)" stroke="#d8b768" strokeWidth="1.6" />
      <circle cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.pockets * 0.62} fill="none" stroke="#e3c170" strokeOpacity="0.35" strokeWidth="1" />
      <Turret />
    </g>
  )
})

/** The brass turret at the hub, with its four arms. */
function Turret() {
  const arm = WHEEL.pockets * 0.72
  return (
    <g>
      {[0, 90, 180, 270].map((a) => {
        const [x, y] = onWheel(a, arm)
        return (
          <g key={a}>
            <line x1={WHEEL.cx} y1={WHEEL.cy} x2={x} y2={y} stroke="url(#gold-foil)" strokeWidth="5" strokeLinecap="round" />
            <circle cx={x} cy={y} r="6.5" fill="url(#gold-foil)" stroke="#7a5a1c" strokeWidth="0.8" />
          </g>
        )
      })}
      <circle cx={WHEEL.cx} cy={WHEEL.cy} r="16" fill="url(#gold-foil)" stroke="#7a5a1c" strokeWidth="1" />
      <circle cx={WHEEL.cx - 4} cy={WHEEL.cy - 5} r="5" fill="#fff" opacity="0.35" />
    </g>
  )
}
