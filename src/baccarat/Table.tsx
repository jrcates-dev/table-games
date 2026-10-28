import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useRef, type ReactNode } from 'react'
import { play } from '../audio'
import { CAMERA, DISCARD, PLANE, SHOE, TRAY } from '../blackjack/geometry'
import { ChipStack } from '../components/ChipStack'
import { FeltCard } from '../components/FeltCard'
import { stackAt, stackMove } from '../components/feltMotion'
import { pickOrPlace, type Describe } from '../components/pick'
import { tipHandlers } from '../components/tip'
import * as bac from '../engine/baccarat/baccarat'
import { BACCARAT_BETS } from '../engine/baccarat/rules'
import { handTotal } from '../engine/baccarat/tableau'
import type { BaccaratBetKind, BaccaratState, CoupCard } from '../engine/baccarat/types'
import { usePrefs } from '../prefs/prefsStore'
import { cardAt, dealTiming, useBaccaratStore } from '../store/baccaratStore'
import { anchorFor, cardSpot, shapePath, SPOTS, TOTAL } from './geometry'

const SHOE_MOUTH = { x: SHOE.x - 30, y: SHOE.y + 60, angle: SHOE.angle }
const TO_DISCARD = { x: DISCARD.x, y: DISCARD.y, angle: DISCARD.angle }

/** The click targets: the printed shapes themselves. Left-click (a tap) bets the chip in hand; right-click (a held card's button) takes the bet back. */
export function SpotLayer() {
  const game = useBaccaratStore((s) => s.game)
  const placeAt = useBaccaratStore((s) => s.placeAt)
  const takeDown = useBaccaratStore((s) => s.takeDown)
  const describe: Describe = (id) => {
    const kind = id as BaccaratBetKind
    const open = game.phase === 'settled' ? bac.nextCoup(game) : game
    return bac.canPlace(open, kind).ok ? { title: BACCARAT_BETS[kind].title, pays: BACCARAT_BETS[kind].pays } : null
  }
  return (
    <svg className="cr-spots" width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`}>
      {SPOTS.map((spot) => {
        const allowed = game.phase !== 'dealt'
        return (
          <path
            key={spot.kind}
            d={shapePath(spot.shape)}
            className={`cr-spot${allowed ? '' : ' is-blocked'}`}
            data-spot={spot.kind}
            {...tipHandlers(spot.kind, allowed, game.phase === 'betting' && game.bets[spot.kind] ? () => takeDown(spot.kind) : undefined)}
            onClick={(event) => pickOrPlace(event, spot.kind, (id) => placeAt(id as BaccaratBetKind), describe)}
            onContextMenu={(event) => {
              event.preventDefault()
              takeDown(spot.kind)
            }}
          />
        )
      })}
    </svg>
  )
}

/** The coup, turned over the way the dealer turns it: see `REVEAL`. */
export const CardLayer = memo(function CardLayer() {
  const coup = useBaccaratStore((s) => s.game.coup)
  const seq = useBaccaratStore((s) => s.game.seq)
  const phase = useBaccaratStore((s) => s.game.phase)
  const step = useBaccaratStore((s) => s.step)
  const speed = useBaccaratStore((s) => s.profile.settings.dealSpeed)
  const back = usePrefs((s) => s.cardBack)
  const { interval, flight } = dealTiming(speed)
  const settled = phase === 'settled' && coup
  const cards = coup ? [...coup.player, ...coup.banker] : []

  return (
    <AnimatePresence>
      {cards.map((card) => {
        const shown = settled ? { out: true, faceDown: false } : cardAt(card, step)
        if (!shown.out) return null
        const hand = card.side === 'player' ? coup!.player : coup!.banker
        const index = hand.indexOf(card)
        const lost = settled && coup!.winner !== 'tie' && coup!.winner !== card.side
        return (
          <FeltCard
            key={`${seq}:${card.id}`}
            card={{ ...card, faceDown: shown.faceDown }}
            place={{ ...cardSpot(card.side, index), order: index }}
            from={SHOE_MOUTH}
            away={TO_DISCARD}
            delay={card.seq < 4 ? card.seq * interval : 0}
            flight={flight}
            back={back}
            dim={Boolean(lost)}
          />
        )
      })}
    </AnimatePresence>
  )
})

function Billboard({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="bj-billboard" style={{ left: x, top: y }}>
      <div className="bj-billboard__stand" style={{ transform: `translateX(-50%) rotateX(${-CAMERA.tilt}deg)` }}>
        {children}
      </div>
    </div>
  )
}

function visibleTotal(hand: CoupCard[], step: number, settled: boolean): number | null {
  const up = hand.filter((c) => {
    const shown = settled ? { out: true, faceDown: false } : cardAt(c, step)
    return shown.out && !shown.faceDown
  })
  return up.length < 2 ? null : handTotal(up.map((c) => c.rank))
}

/** Each hand's total, standing beside its box as soon as it is turned. */
export function Totals() {
  const coup = useBaccaratStore((s) => s.game.coup)
  const phase = useBaccaratStore((s) => s.game.phase)
  const step = useBaccaratStore((s) => s.step)
  const seq = useBaccaratStore((s) => s.game.seq)
  if (!coup) return null
  const settled = phase === 'settled'
  const sides = [
    { side: 'player' as const, total: visibleTotal(coup.player, step, settled), label: 'Player' },
    { side: 'banker' as const, total: visibleTotal(coup.banker, step, settled), label: 'Banker' },
  ]
  return (
    <AnimatePresence>
      {sides.map(({ side, total, label }) => {
        if (total === null) return null
        const won = settled && (coup.winner === side || coup.winner === 'tie')
        const natural = (side === 'player' ? coup.player : coup.banker).length === 2 && total >= 8
        return (
          <Billboard key={`${seq}:${side}`} x={TOTAL[side].x} y={TOTAL[side].y}>
            <motion.div
              className={`total-pill ba-total ba-total--${side}${won ? ' is-active' : ''}${natural ? ' is-natural' : ''}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="total-pill__who">{natural ? 'Natural' : label}</span>
              <strong className="num">{total}</strong>
            </motion.div>
          </Billboard>
        )
      })}
    </AnimatePresence>
  )
}

interface StackItem {
  key: string
  amount: number
  at: [number, number]
  from?: [number, number]
  swept?: boolean
  delay?: number
  seed: number
}

const PLAYER_SIDE: [number, number] = [750, 1010]
const SIZE = 52

/**
 * Chips on the apron. Bets stand while the coup is out; once it settles the
 * losers are raked into the tray, winners are paid beside their bet from it,
 * and when the felt reopens what is yours slides back across the rail.
 */
function stacksFor(game: BaccaratState): StackItem[] {
  // A coup's chips keep their keys from the moment they go down to the moment
  // they come off, so dealing never re-drops them and reopening clears them.
  const round = game.phase === 'betting' ? game.seq + 1 : game.seq
  const items: StackItem[] = []
  const kinds = Object.keys(game.bets) as BaccaratBetKind[]
  kinds.forEach((kind, i) => {
    const amount = game.bets[kind] ?? 0
    if (amount <= 0) return
    const at = anchorFor(kind)
    const r = game.phase === 'settled' ? game.resolutions.find((x) => x.kind === kind) : undefined
    items.push({ key: `${round}:bet:${kind}`, amount, at, swept: r?.effect === 'lose', delay: 0.35 + i * 0.08, seed: i * 7 + 3 })
    if (r?.effect === 'win') {
      items.push({
        key: `${round}:pay:${kind}`,
        amount: r.net,
        at: [at[0] + SIZE * 0.95, at[1] + 4],
        from: [TRAY.x + (i - 3) * 40, TRAY.y + 20],
        delay: 0.45 + i * 0.12,
        seed: i * 11 + 40,
      })
    }
  })
  return items
}

export const BetLayer = memo(function BetLayer() {
  const game = useBaccaratStore((s) => s.game)
  const items = stacksFor(game)
  useSettleSounds(game)
  return (
    <AnimatePresence>
      {items.map((item) => (
        <Stack key={item.key} item={item} />
      ))}
    </AnimatePresence>
  )
})

function Stack({ item }: { item: StackItem }) {
  const start = item.from ?? item.at
  const delay = item.from || item.swept ? item.delay ?? 0 : 0
  const end = item.swept ? ([TRAY.x + ((item.seed * 37) % 160) - 80, TRAY.y + 8] as const) : item.at
  return (
    <motion.div
      className="bj-stack"
      {...stackMove(start, end, { grow: !!item.from, swept: !!item.swept, delay, sinkAt: 0.42 })}
      exit={
        item.swept
          ? { opacity: 0, transition: { duration: 0 } }
          : { transform: stackAt([item.at[0], PLAYER_SIDE[1]]), transition: { duration: 0.6, ease: [0.5, 0, 0.3, 1] } }
      }
    >
      <div className="bj-stack__shadow" style={{ width: SIZE * 1.1, height: SIZE * 0.9 }} />
      <ChipStack amount={item.amount} size={SIZE} tilt={CAMERA.tilt} seed={item.seed} dropIn={!item.from} />
    </motion.div>
  )
}

function useSettleSounds(game: BaccaratState) {
  const phase = useRef(game.phase)
  useEffect(() => {
    const was = phase.current
    phase.current = game.phase
    if (game.phase !== 'settled' || was === 'settled') return
    if (game.resolutions.some((r) => r.effect === 'lose')) play('chipSlide', { at: 0.4 })
    const paid = game.resolutions.filter((r) => r.effect === 'win').length
    for (let i = 0; i < Math.min(paid, 3); i++) play('chipStack', { at: 0.6 + i * 0.14, count: 5 })
  }, [game.phase, game.resolutions])
}
