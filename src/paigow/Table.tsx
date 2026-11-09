import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useRef } from 'react'
import { play } from '../audio'
import { CAMERA, PLANE, TRAY, type Spot } from '../blackjack/geometry'
import { Billboard } from '../components/Billboard'
import { ChipStack } from '../components/ChipStack'
import { FeltCard } from '../components/FeltCard'
import { stackAt, stackMove } from '../components/feltMotion'
import { pickOrPlace, type Describe } from '../components/pick'
import { tipHandlers } from '../components/tip'
import { handName } from '../engine/paigow/hands'
import { houseWay } from '../engine/paigow/houseWay'
import * as pg from '../engine/paigow/paigow'
import { setHand } from '../engine/paigow/split'
import type { PaiGowCard, PaiGowState } from '../engine/paigow/types'
import { usePrefs } from '../prefs/prefsStore'
import { paigowDealTiming, usePaiGowStore, type DealerStage } from '../store/paigowStore'
import { BOX_Y, CARD_SCALE, DEAL_Y, DEALER_Y, HIGH_X, LABELS, LOW_X, rowX, SHUFFLER, shufflerMouth, SPOT_ORDER, SPOTS, type PaiGowSpotKind } from './geometry'

export { Shuffler } from '../uth/Table'

const S = CARD_SCALE
const scaled = (at: Spot) => ({ x: at.x / S, y: at.y / S, angle: at.angle })

/** The circles you can bet: the bet itself and Fortune. */
export function SpotLayer() {
  const phase = usePaiGowStore((s) => s.game.phase)
  const bets = usePaiGowStore((s) => s.game.bets)
  const placeAt = usePaiGowStore((s) => s.placeAt)
  const takeDown = usePaiGowStore((s) => s.takeDown)
  const open = phase === 'betting' || phase === 'showdown'
  const describe: Describe = (id) => (!open ? null : id === 'fortune' ? { title: 'Fortune', pays: 'up to 8,000 to 1' } : { title: 'Bet', pays: '1 to 1, less 5%' })
  return (
    <svg className="cr-spots" width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`}>
      {SPOT_ORDER.map((kind) => {
        const s = SPOTS[kind]
        return (
          <circle
            key={kind}
            cx={s.x}
            cy={s.y}
            r={s.r + 4}
            className={`cr-spot${open ? '' : ' is-blocked'}`}
            data-spot={kind}
            {...tipHandlers(kind, open, phase === 'betting' && bets[kind] > 0 ? () => takeDown(kind) : undefined)}
            onClick={(event) => pickOrPlace(event, kind, (id) => placeAt(id as PaiGowSpotKind), describe)}
            onContextMenu={(event) => {
              event.preventDefault()
              takeDown(kind)
            }}
          />
        )
      })}
    </svg>
  )
}

interface Placed {
  card: PaiGowCard
  at: [number, number]
  order: number
  faceDown: boolean
  role: 'player' | 'dealer'
  index: number
  /** In the low hand, in the high hand, or not yet set. */
  hand: 'low' | 'high' | null
}

/** Your seven: set into the boxes, or still in the row they were dealt in. */
function playerPlaces(low: readonly number[]): Array<{ at: [number, number]; hand: 'low' | 'high' | null }> {
  const lowSorted = [...low].sort((a, b) => a - b)
  let high = 0
  return Array.from({ length: 7 }, (_, i) => {
    const k = lowSorted.indexOf(i)
    if (k >= 0) return { at: [LOW_X[k], BOX_Y], hand: 'low' }
    if (low.length === 2) return { at: [HIGH_X[high++], BOX_Y], hand: 'high' }
    return { at: [rowX(i), DEAL_Y], hand: null }
  })
}

function dealerPlaces(low: readonly number[] | null): Array<[number, number]> {
  if (!low) return Array.from({ length: 7 }, (_, i) => [rowX(i), DEALER_Y])
  const lowSorted = [...low].sort((a, b) => a - b)
  let high = 0
  return Array.from({ length: 7 }, (_, i) => {
    const k = lowSorted.indexOf(i)
    return k >= 0 ? [LOW_X[k], DEALER_Y] : [HIGH_X[high++], DEALER_Y]
  })
}

/** The low hand as it lies now: the store's choice while setting, the set once it is down. */
function lowNow(game: PaiGowState, low: readonly number[]): readonly number[] {
  return game.phase === 'setting' ? low : (game.result?.player.low ?? low)
}

function placed(game: PaiGowState, low: readonly number[], stage: DealerStage): Placed[] {
  const done = game.phase === 'showdown'
  const out: Placed[] = []
  playerPlaces(lowNow(game, low)).forEach(({ at, hand }, i) => {
    const card = game.player[i]
    if (card) out.push({ card, at, order: i, faceDown: false, role: 'player', index: i, hand })
  })
  const set = done || stage === 'set' ? (game.result?.dealer.low ?? null) : null
  dealerPlaces(set).forEach((at, i) => {
    const card = game.dealer[i]
    if (card) out.push({ card, at, order: i, faceDown: !(done || stage !== 'down'), role: 'dealer', index: i, hand: null })
  })
  return out
}

/** Every card in the hand, dealt from the shuffler, set, and gathered back into it. */
export const CardLayer = memo(function CardLayer({ shuffler = SHUFFLER }: { shuffler?: Spot }) {
  const game = usePaiGowStore((s) => s.game)
  const low = usePaiGowStore((s) => s.low)
  const stage = usePaiGowStore((s) => s.dealerStage)
  const coach = usePaiGowStore((s) => s.profile.settings.coach)
  const toggle = usePaiGowStore((s) => s.toggleCard)
  const speed = usePaiGowStore((s) => s.profile.settings.dealSpeed)
  const back = usePrefs((s) => s.cardBack)
  const { interval, flight } = paigowDealTiming(speed)
  const setting = game.phase === 'setting'
  const done = game.phase === 'showdown'
  const result = game.result
  const hints = coach && setting ? new Set(houseWay(pg.playerCodes(game), game.rules).set.low) : null

  return (
    <div className="pg-cards" style={{ transform: `scale(${S})` }}>
      <AnimatePresence>
        {placed(game, low, stage).map((p) => {
          // Once paid, a hand that won is lit and one that lost is dimmed — and a foul dims the lot.
          const outcome = done && result && p.role === 'player' && p.hand ? (result.foul ? 'lose' : result[p.hand]) : null
          return (
            <FeltCard
              key={`${game.seq}:${p.card.id}`}
              card={{ ...p.card, faceDown: p.faceDown }}
              joker={p.card.joker}
              place={{ x: p.at[0] / S, y: p.at[1] / S, spin: 0, order: p.order + (p.hand === 'low' ? 7 : 0) }}
              from={scaled(shufflerMouth(shuffler))}
              away={scaled(shuffler)}
              delay={p.card.seq * interval}
              flight={flight}
              back={back}
              lit={outcome === 'win'}
              dim={outcome !== null && outcome !== 'win'}
              onPick={setting && p.role === 'player' ? () => toggle(p.index) : undefined}
              hint={hints?.has(p.index) ?? false}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
})

type Verdict = 'win' | 'lose' | 'copy'

const VERDICT: Record<Verdict, string> = { win: 'wins', lose: 'loses', copy: 'copy' }

/** Each hand's name: yours as you set it, the dealer's once it is set. */
export function HandLabels() {
  const game = usePaiGowStore((s) => s.game)
  const low = usePaiGowStore((s) => s.low)
  const stage = usePaiGowStore((s) => s.dealerStage)
  const result = game.result
  const done = game.phase === 'showdown'
  const now = lowNow(game, low)
  const mine = game.player.length === 7 && now.length === 2 ? setHand(pg.playerCodes(game), now, game.rules) : null
  const dealerShown = result && (done || stage === 'set')
  const foul = mine ? !mine.legal : false
  const pills: Array<{ key: string; at: { x: number; y: number }; who: string; name: string; tone: string }> = []
  if (mine) {
    const verdict = (hand: 'low' | 'high'): string => (done && result ? (result.foul ? 'foul' : result[hand]) : foul ? 'foul' : '')
    const lowV = verdict('low')
    const highV = verdict('high')
    pills.push({ key: 'pl', at: LABELS.playerLow, who: lowV && lowV !== 'foul' ? `Low · ${VERDICT[lowV as Verdict]}` : 'Low', name: handName(mine.lowScore, 2), tone: lowV })
    pills.push({ key: 'ph', at: LABELS.playerHigh, who: highV === 'foul' ? 'Foul — the low hand is higher' : highV ? `High · ${VERDICT[highV as Verdict]}` : 'High', name: handName(mine.highScore, 5), tone: highV })
  }
  if (dealerShown) {
    const flip = (v: Verdict): string => (v === 'win' ? 'lose' : 'win')
    pills.push({ key: 'dl', at: LABELS.dealerLow, who: 'Dealer low', name: result.dealer.lowName, tone: done && !result.foul ? flip(result.low) : '' })
    pills.push({ key: 'dh', at: LABELS.dealerHigh, who: 'Dealer high', name: result.dealer.highName, tone: done && !result.foul ? flip(result.high) : '' })
  }
  return (
    <AnimatePresence>
      {pills.map((p) => (
        <Billboard key={`${game.seq}:${p.key}`} x={p.at.x} y={p.at.y} tilt={CAMERA.tilt}>
          <motion.div
            className={`total-pill pg-hand${p.tone ? ` is-${p.tone}` : ''}`}
            initial={{ opacity: 0, transform: 'scale(0.7)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0 }}
          >
            <span className="total-pill__who">{p.who}</span>
            <strong>{p.name}</strong>
          </motion.div>
        </Billboard>
      ))}
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

const SIZE = 64
const PLAYER_SIDE: [number, number] = [750, 1010]

function stacksFor(game: PaiGowState): StackItem[] {
  const round = game.phase === 'betting' ? game.seq + 1 : game.seq
  const items: StackItem[] = []
  const done = game.phase === 'showdown'
  SPOT_ORDER.forEach((kind, i) => {
    const amount = game.bets[kind]
    if (amount <= 0) return
    const s = SPOTS[kind]
    const at: [number, number] = [s.x, s.y]
    const r = done ? game.resolutions.find((x) => x.kind === kind) : undefined
    items.push({ key: `${round}:bet:${kind}`, amount, at, swept: r?.effect === 'lose', delay: 0.3 + i * 0.1, seed: i * 7 + 3 })
    if (r?.effect === 'win' && r.net > 0) {
      // The bet is paid on its right; Fortune, at the felt's edge, on its left.
      const side = kind === 'fortune' ? -1 : 1
      items.push({
        key: `${round}:pay:${kind}`,
        amount: r.net,
        at: [at[0] + side * SIZE * 1.05, at[1] - 8],
        from: [TRAY.x + (i - 0.5) * 80, TRAY.y + 20],
        delay: 0.5 + i * 0.14,
        seed: i * 11 + 40,
      })
    }
  })
  return items
}

/** Chips in the circles: they stand through the hand, then the losers are raked and the winners paid. */
export const BetLayer = memo(function BetLayer() {
  const game = usePaiGowStore((s) => s.game)
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

function useSettleSounds(game: PaiGowState) {
  const phase = useRef(game.phase)
  useEffect(() => {
    const was = phase.current
    phase.current = game.phase
    if (game.phase !== 'showdown' || was === 'showdown') return
    if (game.resolutions.some((r) => r.effect === 'lose')) play('chipSlide', { at: 0.35 })
    const paid = game.resolutions.filter((r) => r.effect === 'win').length
    for (let i = 0; i < paid; i++) play('chipStack', { at: 0.6 + i * 0.14, count: 5 })
  }, [game.phase, game.resolutions])
}
