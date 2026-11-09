import { useEffect, useRef, type CSSProperties } from 'react'
import { isRed, SUIT_PATH } from '../components/suits'
import type { Suit } from '../engine/types'
import { BANKS, BULBS, bankKeyframes, SHOW_MS } from './lightShow'

/**
 * The pieces of the lobby's sign: the bulbs round its frame and their light
 * show, the name in neon, the starburst the house chip sits in, and the suits
 * either side of the line beneath.
 */

/**
 * The sockets, and over them the lamps wired in six banks (see lightShow.ts).
 * The show runs as six Web Animations started on the same tick, so the banks
 * stay in step however long the lobby is left open. Asked for less motion,
 * the sign simply stays lit.
 */
export function MarqueeBulbs() {
  const banks = useRef<Array<HTMLDivElement | null>>([])
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const animations: Animation[] = []
    banks.current.forEach((layer, bank) => {
      if (layer && typeof layer.animate === 'function') {
        animations.push(layer.animate(bankKeyframes(bank), { duration: SHOW_MS, iterations: Infinity }))
      }
    })
    const start = document.timeline?.currentTime ?? null
    if (start !== null) for (const animation of animations) animation.startTime = start
    return () => animations.forEach((animation) => animation.cancel())
  }, [])
  return (
    <div className="marquee__bulbs" aria-hidden="true">
      {BULBS.map((bulb, i) => (
        <span key={i} className="marquee__bulb" style={{ left: `${bulb.x}%`, top: `${bulb.y}%` }} />
      ))}
      {Array.from({ length: BANKS }, (_, bank) => (
        <div
          key={bank}
          ref={(el) => {
            banks.current[bank] = el
          }}
          className="marquee__lights"
        >
          {BULBS.map((bulb, i) =>
            i % BANKS === bank ? <span key={i} className="marquee__lamp" style={{ left: `${bulb.x}%`, top: `${bulb.y}%` }} /> : null,
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * The name in neon: each letter a tube of glass, dull rose when it is off,
 * with the lit tube laid over it. The tubes strike one after another the
 * first time the lobby opens, and one of them never quite settles.
 */
export function NeonWord({ word, flicker }: { word: string; flicker: boolean }) {
  return (
    <span className={`neon${flicker ? ' neon--strike' : ''}`} aria-hidden="true">
      {[...word].map((letter, i) => (
        <span key={i} className="neon__letter" style={{ '--i': i } as CSSProperties}>
          {letter}
          <span className="neon__lit">{letter}</span>
        </span>
      ))}
    </span>
  )
}

/** Rays per side of the vertical, and the angle the outermost makes with it. */
const RAYS = 8
const SPREAD = 84

/**
 * A gold starburst rising behind the house chip, the crown of every sign on
 * the old Strip: spikes long and short in turn, a bulb on the tip of each
 * long one. Drawn in a 200 × 100 box whose bottom-centre is the chip's centre.
 */
export function CrestRays() {
  const at = (r: number, a: number) => `${(r * Math.sin(a)).toFixed(1)} ${(100 - r * Math.cos(a)).toFixed(1)}`
  const rays: string[] = []
  const tips: Array<[number, number]> = []
  for (let i = -RAYS; i <= RAYS; i++) {
    const angle = ((i / RAYS) * SPREAD * Math.PI) / 180
    const long = i % 2 === 0
    const length = long ? 98 : 66
    const half = long ? 0.15 : 0.11
    rays.push(`M ${at(24, angle - half)} L ${at(length, angle)} L ${at(24, angle + half)} Z`)
    if (long) tips.push([(length + 2) * Math.sin(angle), 100 - (length + 2) * Math.cos(angle)])
  }
  return (
    <svg className="crest-rays" viewBox="-100 0 200 100" aria-hidden="true">
      <defs>
        <radialGradient id="crest-ray" cx="0" cy="100" r="100" gradientUnits="userSpaceOnUse">
          <stop offset="0.25" stopColor="#fff4d2" />
          <stop offset="0.6" stopColor="#e9c77c" />
          <stop offset="1" stopColor="#b98a3a" />
        </radialGradient>
        <radialGradient id="crest-glow" cx="0" cy="100" r="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="0" cy="100" r="62" fill="url(#crest-glow)" />
      <path d={rays.join(' ')} fill="url(#crest-ray)" />
      {tips.map(([x, y], i) => (
        <circle key={i} className="crest-rays__bulb" cx={x.toFixed(1)} cy={y.toFixed(1)} r="4.2" style={{ '--i': i } as CSSProperties} />
      ))}
    </svg>
  )
}

/** Two suit pips, set either side of the sign's subtitle. */
export function SuitPips({ suits }: { suits: Suit[] }) {
  return (
    <span className="lobby__pips" aria-hidden="true">
      {suits.map((suit) => (
        <svg key={suit} className={`lobby__pip${isRed(suit) ? ' lobby__pip--red' : ''}`} viewBox="0 0 100 100">
          <path d={SUIT_PATH[suit]} />
        </svg>
      ))}
    </span>
  )
}
