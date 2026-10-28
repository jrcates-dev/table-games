import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useRef } from 'react'
import { play } from '../audio'
import { Billboard } from '../components/Billboard'
import { ChipStack } from '../components/ChipStack'
import { fromTip, pickOrPlace, type Describe } from '../components/pick'
import { tipHandlers, useTip } from '../components/tip'
import { betById } from '../engine/roulette/bets'
import type { RouletteState } from '../engine/roulette/types'
import { pocketColor, pocketLabel } from '../engine/roulette/wheel'
import { useRouletteStore } from '../store/rouletteStore'
import { spotId, tipFor } from './betInfo'
import { anchorFor, BANK, CAMERA, centre, PLANE, pocketRect, RACK, spotsFor } from './geometry'

/** The click targets, cut from the layout's own lines. Left-click bets the chip in hand; right-click takes the bet back. */
export function SpotLayer() {
  const wheel = useRouletteStore((s) => s.game.wheel)
  const phase = useRouletteStore((s) => s.game.phase)
  const bets = useRouletteStore((s) => s.game.bets)
  const placeAt = useRouletteStore((s) => s.placeAt)
  const takeDown = useRouletteStore((s) => s.takeDown)
  const allowed = phase !== 'spinning'
  const describe: Describe = (id) => fromTip(tipFor(useRouletteStore.getState().game, spotId(id), false))
  return (
    <svg className="cr-spots ro-spots" width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`}>
      {spotsFor(wheel).map((spot) => (
        <rect
          key={spot.id}
          x={spot.zone.x0}
          y={spot.zone.y0}
          width={spot.zone.x1 - spot.zone.x0}
          height={spot.zone.y1 - spot.zone.y0}
          rx={spot.layer === 0 ? 6 : 4}
          className={`cr-spot ro-spot ro-spot--l${spot.layer}${allowed ? '' : ' is-blocked'}`}
          data-spot={spot.id}
          {...tipHandlers(spot.id, allowed, phase === 'betting' && bets[spot.id] ? () => takeDown(spot.id) : undefined)}
          onClick={(event) => pickOrPlace(event, spot.id, placeAt, describe)}
          onContextMenu={(event) => {
            event.preventDefault()
            takeDown(spot.id)
          }}
        />
      ))}
    </svg>
  )
}

/**
 * The numbers a bet covers, lit while the pointer is over it — on the layout
 * or on its row in the rail — and the winning number once the ball is down.
 */
export function HighlightLayer() {
  const hovered = useTip((s) => s.id)
  const wheel = useRouletteStore((s) => s.game.wheel)
  const phase = useRouletteStore((s) => s.game.phase)
  const result = useRouletteStore((s) => s.game.result)
  const def = hovered ? betById(wheel, spotId(hovered)) : undefined
  const winner = phase === 'settled' && result !== null ? pocketRect(result, wheel) : null
  return (
    <>
      <svg className="ro-lights" width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`} aria-hidden="true">
        {winner && <rect x={winner.x0 + 3} y={winner.y0 + 3} width={winner.x1 - winner.x0 - 6} height={winner.y1 - winner.y0 - 6} rx="8" className="ro-light ro-light--win" />}
        {def?.numbers.map((n) => {
          const r = pocketRect(n, wheel)
          return <rect key={n} x={r.x0 + 4} y={r.y0 + 4} width={r.x1 - r.x0 - 8} height={r.y1 - r.y0 - 8} rx="7" className="ro-light" />
        })}
      </svg>
      {/* The winner's glow brightens and dims on a layer of its own, so the layout is not repainted as it does. */}
      {winner && (
        <svg className="ro-lights ro-lights--glow" width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`} aria-hidden="true">
          <rect x={winner.x0 + 3} y={winner.y0 + 3} width={winner.x1 - winner.x0 - 6} height={winner.y1 - winner.y0 - 6} rx="8" className="ro-light--glow" />
        </svg>
      )}
    </>
  )
}

/** The dolly: the dealer's marker on the winning number, there until the layout reopens. */
export function Dolly() {
  const phase = useRouletteStore((s) => s.game.phase)
  const result = useRouletteStore((s) => s.game.result)
  const wheel = useRouletteStore((s) => s.game.wheel)
  const seq = useRouletteStore((s) => s.game.seq)
  const show = phase === 'settled' && result !== null
  const [x, y] = result !== null ? centre(pocketRect(result, wheel)) : [0, 0]
  return (
    <AnimatePresence>
      {show && (
        <Billboard key={seq} x={x} y={y} tilt={CAMERA.tilt}>
          <motion.div
            className={`ro-dolly ro-dolly--${pocketColor(result!)}`}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            <span className="ro-dolly__crown">{pocketLabel(result!)}</span>
            <span className="ro-dolly__stem" />
            <span className="ro-dolly__base" />
          </motion.div>
        </Billboard>
      )}
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

const SIZE = 40
const EASE: [number, number, number, number] = [0.25, 0.7, 0.3, 1]

function seedOf(id: string): number {
  let h = 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return h
}

/**
 * Chips on the layout. They stand while the ball runs; once it drops the
 * losers are raked to the dealer's float, each winner is paid beside its bet,
 * and when the layout reopens what is yours slides back across the rail.
 */
function stacksFor(game: RouletteState): StackItem[] {
  const round = game.phase === 'betting' ? game.seq + 1 : game.seq
  const items: StackItem[] = []
  const settled = game.phase === 'settled'
  Object.values(game.bets).forEach((bet, i) => {
    const at = anchorFor(game.wheel, bet.id)
    const r = settled ? game.resolutions.find((x) => x.betId === bet.id) : undefined
    const seed = seedOf(bet.id)
    items.push({ key: `${round}:bet:${bet.id}`, amount: bet.amount, at, swept: r?.effect === 'lose', delay: 0.35 + (i % 8) * 0.05, seed })
    if (r?.effect === 'win') {
      items.push({
        key: `${round}:pay:${bet.id}`,
        amount: r.net,
        at: [at[0] + SIZE * 0.85, at[1] + 4],
        from: [BANK[0] + ((i * 47) % 300) - 150, BANK[1] + 52],
        delay: 0.7 + i * 0.12,
        seed: seed + 5,
      })
    }
  })
  return items
}

export const BetLayer = memo(function BetLayer() {
  const game = useRouletteStore((s) => s.game)
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
  const delay = item.from || item.swept ? (item.delay ?? 0) : 0
  const target = item.swept
    ? { x: BANK[0] + ((item.seed * 37) % 300) - 150, y: BANK[1] + 52, scale: 0.01 }
    : { x: item.at[0], y: item.at[1], scale: 1 }
  return (
    <motion.div
      className="bj-stack"
      initial={{ x: start[0], y: start[1], scale: item.from ? 0.45 : 1 }}
      animate={target}
      exit={item.swept ? { opacity: 0, transition: { duration: 0 } } : { x: RACK[0], y: RACK[1], transition: { duration: 0.6, ease: [0.5, 0, 0.3, 1] } }}
      transition={{
        x: { duration: item.swept ? 0.6 : 0.55, delay, ease: EASE },
        y: { duration: item.swept ? 0.6 : 0.55, delay, ease: EASE },
        scale: item.swept ? { duration: 0.22, delay: delay + 0.5 } : { duration: 0.45, delay, ease: EASE },
      }}
    >
      <div className="bj-stack__shadow" style={{ width: SIZE * 1.1, height: SIZE * 0.9 }} />
      <ChipStack amount={item.amount} size={SIZE} tilt={CAMERA.tilt} seed={item.seed} dropIn={!item.from} />
    </motion.div>
  )
}

function useSettleSounds(game: RouletteState) {
  const phase = useRef(game.phase)
  useEffect(() => {
    const was = phase.current
    phase.current = game.phase
    if (game.phase !== 'settled' || was === 'settled') return
    if (game.resolutions.some((r) => r.effect === 'lose')) play('chipSlide', { at: 0.45 })
    const paid = game.resolutions.filter((r) => r.effect === 'win').length
    for (let i = 0; i < Math.min(paid, 4); i++) play('chipStack', { at: 0.8 + i * 0.14, count: 5 })
  }, [game.phase, game.resolutions])
}
