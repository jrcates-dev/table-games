import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useRef, useState } from 'react'
import { play } from '../audio'
import { ChipStack } from '../components/ChipStack'
import * as craps from '../engine/craps/craps'
import type { Bet, CrapsState, PointNumber, Resolution } from '../engine/craps/types'
import { useCrapsStore } from '../store/crapsStore'
import { anchorFor, CAMERA, PLAYER_X, puckPosition } from './layout'

/**
 * Money on the felt, and the dealer's hands moving it.
 *
 * Standing bets are one stack each, keyed by the bet itself so a stack grows
 * as chips are added. When a roll settles, the dealer works the table: losing
 * bets are raked into the bank, winners are paid out of it and pushed back to
 * you, and a come bet that travelled walks across to its number.
 */

const SIZE = 50
/** Where the house's money lives: the bank set into the far rail. */
const BANK: [number, number] = [1000, 40]
/** Where the player's money lives: their rack, just off the near rail. */
const RACK: [number, number] = [PLAYER_X, 960]

interface Ghost {
  key: string
  amount: number
  from: [number, number]
  via?: [number, number]
  to: [number, number]
  delay: number
  seed: number
}

function Stack({ amount, seed, dropIn }: { amount: number; seed: number; dropIn?: boolean }) {
  return (
    <>
      <div className="cr-stack__shadow" />
      <ChipStack amount={amount} size={SIZE} tilt={CAMERA.tilt} seed={seed} perColumn={10} dropIn={dropIn} />
    </>
  )
}

function seedOf(id: string): number {
  let h = 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return h
}

/**
 * The button a dealer sets on a bet: OFF on one that will not act on the next
 * roll, ON on one called on when it would otherwise sit out the come-out. A bet
 * doing what it does by default carries neither.
 */
function workingMarker(bet: Bet, point: PointNumber | null): 'on' | 'off' | null {
  if (!craps.isWorking(bet, point)) return 'off'
  if (bet.working === 'on' && !craps.isWorking({ ...bet, working: 'auto' }, point)) return 'on'
  return null
}

export const BetLayer = memo(function BetLayer() {
  const game = useCrapsStore((s) => s.game)
  const toggleWorking = useCrapsStore((s) => s.toggleWorking)
  const { standing, arrivals } = useStanding(game)
  const ghosts = useSettleGhosts(game)

  return (
    <>
      <AnimatePresence>
        {standing.map((bet) => {
          const [x, y] = anchorFor(bet.kind, bet.number)
          const from = arrivals.get(bet.id)
          const marker = workingMarker(bet, game.point)
          const togglable = game.phase === 'betting' && craps.canToggleWorking(bet)
          return (
            <motion.div
              key={bet.id}
              className="cr-stack"
              initial={from ? { x: from[0], y: from[1] } : { x, y, scale: 1 }}
              animate={{ x, y, scale: 1 }}
              exit={{ scale: 0.01, transition: { duration: 0.18 } }}
              transition={{ duration: from ? 0.6 : 0.3, delay: from ? 0.35 : 0, ease: [0.3, 0.7, 0.3, 1] }}
            >
              <Stack amount={bet.amount} seed={seedOf(bet.id)} dropIn={!from} />
              {marker && (
                <button
                  type="button"
                  className={`cr-off${marker === 'on' ? ' is-on' : ''}`}
                  style={{ transform: `translateX(-50%) translateZ(34px) rotateX(${-CAMERA.tilt}deg)` }}
                  disabled={!togglable}
                  title={togglable ? (marker === 'on' ? 'Working this roll. Click to turn it off.' : 'Off this roll. Click to turn it on.') : undefined}
                  onPointerEnter={() => togglable && play('hover')}
                  onClick={() => toggleWorking(bet.id)}
                >
                  {marker === 'on' ? 'ON' : 'OFF'}
                </button>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {ghosts.map((g) => (
        <motion.div
          key={g.key}
          className="cr-stack"
          initial={{ x: g.from[0], y: g.from[1], scale: g.from === BANK ? 0.4 : 1 }}
          animate={{
            x: g.via ? [g.from[0], g.via[0], g.via[0], g.to[0]] : [g.from[0], g.to[0]],
            y: g.via ? [g.from[1], g.via[1], g.via[1], g.to[1]] : [g.from[1], g.to[1]],
            scale: g.via ? [0.4, 1, 1, 0.3] : [1, 0.01],
          }}
          transition={{ duration: g.via ? 1.7 : 0.55, delay: g.delay, ease: 'easeInOut', times: g.via ? [0, 0.32, 0.72, 1] : undefined }}
        >
          <Stack amount={g.amount} seed={g.seed} />
        </motion.div>
      ))}
    </>
  )
})

/**
 * Standing bets, plus where any newly arrived one walked in from — a come bet
 * that has just travelled starts from the come box rather than appearing on
 * its number.
 */
function useStanding(game: CrapsState) {
  const arrivals = useRef(new Map<string, [number, number]>())
  const lastSeq = useRef(game.seq)

  if (game.phase === 'betting' && lastSeq.current !== game.seq) {
    lastSeq.current = game.seq
    arrivals.current = new Map()
    for (const r of game.resolutions) {
      if (r.effect !== 'move' || !game.roll) continue
      const total = game.roll.total
      if (r.betId === 'come') arrivals.current.set(craps.betId('comePoint', total), anchorFor('come'))
      if (r.betId === 'dontCome') arrivals.current.set(craps.betId('dontComePoint', total), anchorFor('dontCome'))
    }
  }

  return { standing: Object.values(game.bets), arrivals: arrivals.current }
}

/**
 * On each settled roll, the chips that leave the felt: losers to the bank,
 * winnings from the bank to the bet and on to your rack, and stakes that come
 * down with them.
 */
function useSettleGhosts(game: CrapsState): Ghost[] {
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const before = useRef<Record<string, Bet>>({})
  const phase = useRef(game.phase)

  useEffect(() => {
    const was = phase.current
    phase.current = game.phase
    if (game.phase === 'rolling') {
      before.current = game.bets
      return
    }
    if (was !== 'rolling' || game.phase !== 'betting') return

    const out: Ghost[] = []
    let lost = 0
    let paid = 0
    game.resolutions.forEach((r: Resolution, i) => {
      const bet = before.current[r.betId]
      if (!bet) return
      const at = anchorFor(bet.kind, bet.number)
      const seed = seedOf(r.betId) + game.seq
      if (r.effect === 'lose') {
        lost++
        out.push({ key: `${game.seq}:lose:${r.betId}`, amount: r.stake, from: at, to: [BANK[0] + ((i * 53) % 200) - 100, BANK[1]], delay: 0.45, seed })
      } else if (r.effect === 'win') {
        paid++
        const beside: [number, number] = [at[0] + SIZE * 0.9, at[1] + 6]
        out.push({ key: `${game.seq}:pay:${r.betId}`, amount: r.net, from: BANK, via: beside, to: RACK, delay: 0.55 + paid * 0.12, seed: seed + 3 })
        if (r.remaining === 0) out.push({ key: `${game.seq}:back:${r.betId}`, amount: r.stake, from: at, via: at, to: RACK, delay: 0.55 + paid * 0.12, seed })
      } else if (r.effect === 'push' && r.remaining === 0) {
        out.push({ key: `${game.seq}:ret:${r.betId}`, amount: r.stake, from: at, to: RACK, delay: 0.5, seed })
      }
    })

    if (lost > 0) play('chipSlide', { at: 0.5 })
    for (let k = 0; k < Math.min(paid, 4); k++) play('chipStack', { at: 0.95 + k * 0.14, count: 4 })
    setGhosts(out)
    const timer = window.setTimeout(() => setGhosts([]), 3200)
    return () => clearTimeout(timer)
  }, [game.phase, game.bets, game.resolutions, game.seq])

  return ghosts
}

/** The puck: black side up on a come-out, white side up on the point. */
export function Puck() {
  const point = useCrapsStore((s) => s.game.point)
  const [x, y] = puckPosition(point)
  const on = point !== null
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    play('puck', { at: 0.45 })
  }, [point])

  return (
    <motion.div
      className="cr-puck"
      initial={false}
      animate={{ x, y }}
      transition={{ type: 'spring', stiffness: 140, damping: 20, delay: 0.15 }}
    >
      <div className="cr-puck__shadow" />
      <motion.div
        className="cr-puck__stand"
        style={{ rotateX: -CAMERA.tilt }}
        key={on ? 'on' : 'off'}
        initial={{ rotateY: 180, z: 46 }}
        animate={{ rotateY: 0, z: 0 }}
        transition={{ duration: 0.55, delay: 0.2, ease: [0.3, 0.8, 0.3, 1] }}
      >
        <div className={`cr-puck__disc${on ? ' is-on' : ''}`}>{on ? 'ON' : 'OFF'}</div>
      </motion.div>
    </motion.div>
  )
}
