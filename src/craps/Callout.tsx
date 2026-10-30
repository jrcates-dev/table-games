import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { FlatDie } from '../components/CssDie'
import { burst } from '../components/celebrate'
import type { RollLogEntry } from '../engine/craps/types'
import { useEffectsLevel } from '../lib/effects'
import { signedMoney } from '../lib/format'
import { BIG_WIN_MINIMUMS, useCrapsStore } from '../store/crapsStore'
import { stickmanCall, type Call } from './calls'

interface Shown extends Call {
  key: number
  a: number
  b: number
  net: number
}

// Whole transforms, so the browser runs the move itself (see feltMotion).
const CALLOUT_FULL = {
  initial: { opacity: 0, transform: 'translateY(-12px) scale(0.92)' },
  animate: { opacity: 1, transform: 'translateY(0px) scale(1)' },
  exit: { opacity: 0, transform: 'translateY(-8px) scale(1)', transition: { duration: 0.25 } },
  transition: { type: 'spring', stiffness: 380, damping: 24 },
} as const

/** Lighter effects: a short, plain drop and fade. */
const CALLOUT_LIGHT = {
  initial: { opacity: 0, transform: 'translateY(-6px)' },
  animate: { opacity: 1, transform: 'translateY(0px)' },
  exit: { opacity: 0, transition: { duration: 0.2 } },
  transition: { duration: 0.2, ease: [0.2, 0.8, 0.3, 1] },
} as const

/**
 * The call, in lights, the moment the dice come to rest.
 */
export function Callout() {
  const game = useCrapsStore((s) => s.game)
  const lastNet = useCrapsStore((s) => s.lastNet)
  const [shown, setShown] = useState<Shown | null>(null)
  const seen = useRef(game.seq)
  const ref = useRef<HTMLDivElement>(null)
  const light = useEffectsLevel() === 'reduced'

  useEffect(() => {
    if (game.phase !== 'betting' || !game.roll || lastNet === null || seen.current === game.seq) return
    seen.current = game.seq
    const log = game.finishedShoot?.log ?? game.shoot.log
    const entry: RollLogEntry | undefined = log[log.length - 1]
    const call = stickmanCall(game.roll, entry, game.seq)
    setShown({ ...call, key: game.seq, a: game.roll.a, b: game.roll.b, net: lastNet })

    const bigWin = lastNet >= game.limits.minBet * BIG_WIN_MINIMUMS
    const fx = window.setTimeout(() => {
      const el = ref.current
      if (!el || (call.tone !== 'big' && !bigWin)) return
      const rect = el.getBoundingClientRect()
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, bigWin ? 'coins' : 'sparks', bigWin ? 60 : 44)
    }, 200)
    const hide = window.setTimeout(() => setShown(null), 2600)
    return () => {
      clearTimeout(fx)
      clearTimeout(hide)
    }
  }, [game.phase, game.seq, game.roll, game.shoot, game.finishedShoot, game.limits.minBet, lastNet])

  // A new throw clears the old call at once.
  useEffect(() => {
    if (game.phase === 'rolling') setShown(null)
  }, [game.phase])

  return (
    <div className="callout-anchor" ref={ref}>
      <AnimatePresence>
        {shown && (
          <motion.div key={shown.key} className={`callout callout--${shown.tone}`} {...(light ? CALLOUT_LIGHT : CALLOUT_FULL)}>
            <div className="callout__dice">
              <FlatDie value={shown.a} size={30} />
              <FlatDie value={shown.b} size={30} />
            </div>
            <div className="callout__text">
              <span className="callout__title">{shown.title}</span>
              <span className="callout__sub">{shown.sub}</span>
            </div>
            {shown.net !== 0 && <strong className={`callout__net num ${shown.net > 0 ? 'tone-win' : 'tone-lose'}`}>{signedMoney(shown.net)}</strong>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The last run of rolls, newest on the right: the shape of the shoot at a
 * glance, sevens in red and points marked.
 */
export function RollHistory() {
  const shoot = useCrapsStore((s) => s.game.shoot)
  const finished = useCrapsStore((s) => s.profile.history[0])
  const rolls: RollLogEntry[] = shoot.log.length > 0 ? shoot.log : finished?.rolls ?? []
  const recent = rolls.slice(-14)
  if (recent.length === 0) return null

  return (
    <div className="roll-history" aria-label="Recent rolls">
      <span className="eyebrow">{shoot.log.length > 0 ? `Shoot · ${shoot.rolls} roll${shoot.rolls === 1 ? '' : 's'}` : 'Last shoot'}</span>
      <div className="roll-history__row">
        {recent.map((r, i) => (
          <div
            key={`${rolls.length - recent.length + i}`}
            className={`roll-history__roll${r.total === 7 ? ' is-seven' : ''}${r.note === 'pointSet' ? ' is-point' : ''}${r.note === 'pointMade' ? ' is-made' : ''}`}
            title={`${r.a} + ${r.b}${r.note ? ` · ${r.note}` : ''}`}
          >
            <span className="roll-history__total num">{r.total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
