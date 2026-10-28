import { memo, useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { ChipStack } from '../components/ChipStack'
import { CardBackFace, CardFace } from '../components/PlayingCard'
import { DOUBLE_ZERO_ORDER, pocketColor, pocketLabel } from '../engine/roulette/wheel'
import { usePrefs } from '../prefs/prefsStore'

/**
 * The lobby pictures for the three tables that came after blackjack and
 * craps, drawn in the same hand: felt under a gold rail, cards and chips lit
 * from above.
 */

/** A coup in its boxes: the Player's seven, the Banker's natural nine. */
export function BaccaratArt() {
  return (
    <div className="art art--baccarat">
      <div className="art__felt" />
      <div className="art__box art__box--player">
        <span className="art__box-label">Player</span>
      </div>
      <div className="art__box art__box--banker">
        <span className="art__box-label">Banker</span>
      </div>
      <div className="art__pair art__pair--player">
        <div className="art__mini art__mini--a">
          <CardFace rank="5" suit="S" />
        </div>
        <div className="art__mini art__mini--b">
          <CardFace rank="2" suit="H" />
        </div>
      </div>
      <div className="art__pair art__pair--banker">
        <div className="art__mini art__mini--a">
          <CardFace rank="K" suit="D" />
        </div>
        <div className="art__mini art__mini--b">
          <CardFace rank="9" suit="C" />
        </div>
      </div>
    </div>
  )
}

const POCKETS = DOUBLE_ZERO_ORDER
const STEP = 360 / POCKETS.length
const FILL = { red: '#b51d28', black: '#121014', green: '#0f7a44' }
const R = { rim: 100, track: 90, edge: 77.5, numbers: 76, rotor: 60, pockets: 46 }
/** How many times faster the wheel and ball turn while the pointer is over the card. */
const SPIN_UP = 3.2
/** How quickly the pace eases toward that, as a time constant in milliseconds. */
const SPIN_EASE = 320

function arc(r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => {
    const t = ((a - 90) * Math.PI) / 180
    return `${(r * Math.cos(t)).toFixed(2)} ${(r * Math.sin(t)).toFixed(2)}`
  }
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`
}

/**
 * Over the card the wheel spins up, and off it winds back down, from wherever
 * the wheel and ball stand. Changing the CSS animations' duration would
 * recompute their progress and jump both to new places; easing the running
 * animations' playback rate keeps the same turn going.
 */
function useSpinUp(wheel: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = wheel.current
    const card = el?.closest('.game-card')
    if (!el || !card) return
    let rate = 1
    let target = 1
    let frame = 0
    let last = 0
    const step = (now: number) => {
      rate += (target - rate) * (1 - Math.exp(-(now - last) / SPIN_EASE))
      if (Math.abs(target - rate) < 0.005) rate = target
      last = now
      for (const animation of el.getAnimations({ subtree: true })) animation.playbackRate = rate
      frame = rate === target ? 0 : requestAnimationFrame(step)
    }
    const spin = (next: number) => () => {
      target = next
      if (frame) return
      last = performance.now()
      frame = requestAnimationFrame(step)
    }
    const up = spin(SPIN_UP)
    const down = spin(1)
    card.addEventListener('pointerenter', up)
    card.addEventListener('pointerleave', down)
    return () => {
      cancelAnimationFrame(frame)
      card.removeEventListener('pointerenter', up)
      card.removeEventListener('pointerleave', down)
    }
  }, [wheel])
}

/** A double-zero wheel seen from the rail, turning slowly with the ball riding the track. */
export const RouletteArt = memo(function RouletteArt() {
  const wheel = useRef<HTMLDivElement>(null)
  useSpinUp(wheel)
  return (
    <div className="art art--roulette">
      <div className="art__felt" />
      {/* Three pictures stacked, not one: the rotor and the ball each turn as a
          whole layer the compositor spins, so the wheel is painted once rather
          than on every frame. */}
      <div className="art__wheel" ref={wheel}>
        <svg className="art__bowl" viewBox="-104 -104 208 208" aria-hidden="true">
          <defs>
            <radialGradient id="art-bowl" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#6b3a1c" />
              <stop offset="1" stopColor="#2a1408" />
            </radialGradient>
          </defs>
          <circle r={R.rim} fill="url(#art-bowl)" stroke="#e3c170" strokeWidth="2" />
          <circle r={R.track} fill="#1d0f08" stroke="#d8b768" strokeOpacity="0.5" strokeWidth="1" />
        </svg>
        <div className="art__rotor">
          <svg viewBox="-104 -104 208 208" aria-hidden="true">
            <defs>
              <radialGradient id="art-cone" cx="0.4" cy="0.35" r="0.8">
                <stop offset="0" stopColor="#c79055" />
                <stop offset="0.6" stopColor="#7d4a24" />
                <stop offset="1" stopColor="#3d200e" />
              </radialGradient>
            </defs>
            <circle r={R.edge} fill="#c9a24e" />
            {POCKETS.map((pocket, i) => {
              const a0 = (i - 0.5) * STEP
              const a1 = (i + 0.5) * STEP
              const colour = FILL[pocketColor(pocket)]
              return (
                <g key={pocket}>
                  <path d={arc(R.rotor, R.numbers, a0, a1)} fill={colour} stroke="#d8b768" strokeWidth="0.6" />
                  <path d={arc(R.pockets, R.rotor, a0, a1)} fill="#000" opacity="0.45" stroke="#d9d6cf" strokeWidth="0.7" />
                  <text
                    y={-(R.numbers + R.rotor) / 2}
                    transform={`rotate(${i * STEP})`}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="Cormorant Garamond, serif"
                    fontWeight="700"
                    fontSize="8.5"
                    fill="#f6efe0"
                  >
                    {pocketLabel(pocket)}
                  </text>
                </g>
              )
            })}
            <circle r={R.pockets} fill="url(#art-cone)" stroke="#d8b768" strokeWidth="1.2" />
            {[0, 90, 180, 270].map((a) => (
              <line key={a} x1="0" y1="0" x2="0" y2={-R.pockets * 0.72} transform={`rotate(${a})`} stroke="url(#gold-foil)" strokeWidth="3.5" strokeLinecap="round" />
            ))}
            <circle r="9" fill="url(#gold-foil)" stroke="#7a5a1c" strokeWidth="0.8" />
          </svg>
        </div>
        {/* The ball rides the middle of the dark track, between the rotor's gold edge and the bowl's wall. */}
        <div className="art__ball-orbit">
          <svg viewBox="-104 -104 208 208" aria-hidden="true">
            <circle cy={-(R.track + R.edge) / 2} r="4.2" fill="#f4f1ea" stroke="#9d978b" strokeWidth="0.6" />
          </svg>
        </div>
      </div>
      <div className="art__chips art__chips--roulette">
        <div className="art__stack">
          <ChipStack amount={35} size={48} tilt={40} seed={3} billboard={false} />
        </div>
      </div>
    </div>
  )
})

/** Your two cards under a flop that hands you a royal draw, the turn and river still to come. */
export function UthArt() {
  const back = usePrefs((s) => s.cardBack)
  const board: Array<['A' | 'K' | 'Q' | 'J' | '10', 'S' | 'H'] | null> = [['Q', 'S'], ['J', 'S'], ['10', 'H'], null, null]
  return (
    <div className="art art--uth">
      <div className="art__felt" />
      <div className="art__board">
        {board.map((card, i) => (
          <div key={i} className="art__mini" style={{ '--slot': i } as CSSProperties}>
            {card ? <CardFace rank={card[0]} suit={card[1]} /> : <CardBackFace theme={back} />}
          </div>
        ))}
      </div>
      <div className="art__hole">
        <div className="art__card art__card--a">
          <CardFace rank="A" suit="S" />
        </div>
        <div className="art__card art__card--b">
          <CardFace rank="K" suit="S" />
        </div>
      </div>
      <div className="art__chips art__chips--uth">
        <div className="art__stack">
          <ChipStack amount={100} size={48} tilt={40} seed={8} billboard={false} />
        </div>
      </div>
    </div>
  )
}
