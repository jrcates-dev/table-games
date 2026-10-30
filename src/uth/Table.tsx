import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useRef } from 'react'
import { play } from '../audio'
import { CAMERA, PLANE, TRAY } from '../blackjack/geometry'
import { Billboard } from '../components/Billboard'
import { Box3D } from '../components/Box3D'
import { ChipStack } from '../components/ChipStack'
import { FeltCard } from '../components/FeltCard'
import { stackAt, stackMove } from '../components/feltMotion'
import { pickOrPlace, type Describe } from '../components/pick'
import { CardBackFace } from '../components/PlayingCard'
import { tipHandlers } from '../components/tip'
import type { DealtCard } from '../engine/types'
import type { UthState } from '../engine/uth/types'
import { usePrefs } from '../prefs/prefsStore'
import { uthDealTiming, useUthStore } from '../store/uthStore'
import { boardSpot, CARD_SCALE, dealerSpot, LABELS, playerSpot, SHUFFLER, SHUFFLER_MOUTH, SPOT_ORDER, SPOTS, type UthSpotKind } from './geometry'

const S = CARD_SCALE
const FROM = { x: SHUFFLER_MOUTH.x / S, y: SHUFFLER_MOUTH.y / S, angle: SHUFFLER_MOUTH.angle }
const AWAY = { x: SHUFFLER.x / S, y: SHUFFLER.y / S, angle: SHUFFLER.angle }

/** The shuffler at the dealer's right: a fresh deck for every hand, and the cards go back in after it. */
export const Shuffler = memo(function Shuffler() {
  const back = usePrefs((s) => s.cardBack)
  return (
    <div className="bj-shoe uth-shuffler" style={{ left: SHUFFLER.x, top: SHUFFLER.y, transform: `rotateZ(${SHUFFLER.angle}deg)` }}>
      <div className="bj-shoe__shadow" />
      <Box3D
        w={136}
        d={186}
        h={76}
        faceClassName="bj-shoe__face"
        faces={{
          top: (
            <div className="uth-shuffler__top">
              <span className="uth-shuffler__led" />
              <div className="uth-shuffler__tray">
                <CardBackFace theme={back} />
              </div>
            </div>
          ),
          front: <div className="bj-shoe__mouth" />,
          left: <div />,
          right: <div />,
        }}
      />
    </div>
  )
})

/** The circles you can bet: Ante (which carries the Blind with it) and Trips. Play is only ever bet with the buttons. */
export function SpotLayer() {
  const phase = useUthStore((s) => s.game.phase)
  const bets = useUthStore((s) => s.game.bets)
  const placeAt = useUthStore((s) => s.placeAt)
  const takeDown = useUthStore((s) => s.takeDown)
  const open = phase === 'betting' || phase === 'showdown'
  const describe: Describe = (id) => (!open ? null : id === 'trips' ? { title: 'Trips', pays: 'up to 50 to 1' } : { title: 'Ante and Blind', pays: '1 to 1' })
  return (
    <svg className="cr-spots" width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`}>
      {SPOT_ORDER.map((kind) => {
        const s = SPOTS[kind]
        const target: 'ante' | 'trips' | null = kind === 'trips' ? 'trips' : kind === 'play' ? null : 'ante'
        return (
          <circle
            key={kind}
            cx={s.x}
            cy={s.y}
            r={s.r + 4}
            className={`cr-spot${open && target ? '' : ' is-blocked'}`}
            data-spot={target ?? undefined}
            {...tipHandlers(kind, open && target !== null, phase === 'betting' && target && bets[target] > 0 ? () => takeDown(target) : undefined)}
            onClick={(event) => target && pickOrPlace(event, target, (id) => placeAt(id as 'ante' | 'trips'), describe)}
            onContextMenu={(event) => {
              event.preventDefault()
              if (target) takeDown(target)
            }}
          />
        )
      })}
    </svg>
  )
}

interface Placed {
  card: DealtCard
  at: [number, number]
  order: number
  faceDown: boolean
  role: 'player' | 'dealer' | 'board'
  index: number
}

/** Which cards are on the felt and which way up, as the table has turned them so far. */
function placed(game: UthState, boardShown: number, dealerShown: boolean): Placed[] {
  const done = game.phase === 'showdown'
  const out: Placed[] = []
  game.player.forEach((card, i) => out.push({ card, at: playerSpot(i), order: i, faceDown: false, role: 'player', index: i }))
  game.dealer.forEach((card, i) => out.push({ card, at: dealerSpot(i), order: i, faceDown: !(done || dealerShown), role: 'dealer', index: i }))
  game.board.forEach((card, i) => out.push({ card, at: boardSpot(i), order: i, faceDown: !(done || i < boardShown), role: 'board', index: i }))
  return out
}

/** Every card in the hand, dealt from the shuffler and gathered back into it. */
export const CardLayer = memo(function CardLayer() {
  const game = useUthStore((s) => s.game)
  const boardShown = useUthStore((s) => s.boardShown)
  const dealerShown = useUthStore((s) => s.dealerShown)
  const speed = useUthStore((s) => s.profile.settings.dealSpeed)
  const back = usePrefs((s) => s.cardBack)
  const { interval, flight } = uthDealTiming(speed)
  const result = game.result
  const read = result && (dealerShown || game.phase === 'showdown')
  const best = new Set(read ? result.playerBest : [])

  return (
    <div className="uth-cards" style={{ transform: `scale(${S})` }}>
      <AnimatePresence>
        {placed(game, boardShown, dealerShown).map((p) => {
          // Indices into hole-then-board: the player's two cards are 0 and 1, the board 2 to 6.
          const bestIndex = p.role === 'player' ? p.index : p.role === 'board' ? p.index + 2 : -1
          const lit = Boolean(read) && best.has(bestIndex)
          const dim = Boolean(read) && p.role !== 'dealer' && !best.has(bestIndex)
          return (
            <FeltCard
              key={`${game.seq}:${p.card.id}`}
              card={{ ...p.card, faceDown: p.faceDown }}
              place={{ x: p.at[0] / S, y: p.at[1] / S, spin: 0, order: p.order }}
              from={FROM}
              away={AWAY}
              delay={p.card.seq * interval}
              flight={flight}
              back={back}
              lit={lit}
              dim={dim}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
})

/** Each hand's name, once it is read. */
export function HandLabels() {
  const game = useUthStore((s) => s.game)
  const dealerShown = useUthStore((s) => s.dealerShown)
  const result = game.result
  const show = result && (dealerShown || game.phase === 'showdown')
  return (
    <AnimatePresence>
      {show && (
        <Billboard key={`d${game.seq}`} x={LABELS.dealer.x} y={LABELS.dealer.y} tilt={CAMERA.tilt}>
          <motion.div className={`total-pill uth-hand uth-hand--dealer${result.outcome === 'lose' ? ' is-active' : ''}`} initial={{ opacity: 0, transform: 'scale(0.7)' }} animate={{ opacity: 1, transform: 'scale(1)' }} exit={{ opacity: 0 }}>
            <span className="total-pill__who">{result.dealerQualifies ? 'Dealer' : 'Dealer · does not open'}</span>
            <strong>{result.dealerName}</strong>
          </motion.div>
        </Billboard>
      )}
      {show && (
        <Billboard key={`p${game.seq}`} x={LABELS.player.x} y={LABELS.player.y} tilt={CAMERA.tilt}>
          <motion.div className={`total-pill uth-hand${result.outcome === 'win' ? ' is-active' : ''}`} initial={{ opacity: 0, transform: 'scale(0.7)' }} animate={{ opacity: 1, transform: 'scale(1)' }} exit={{ opacity: 0 }}>
            <span className="total-pill__who">{result.outcome === 'fold' ? 'You · folded' : 'You'}</span>
            <strong>{result.playerName}</strong>
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

const SIZE = 62
const PLAYER_SIDE: [number, number] = [750, 1010]

function stacksFor(game: UthState): StackItem[] {
  const round = game.phase === 'betting' ? game.seq + 1 : game.seq
  const items: StackItem[] = []
  const done = game.phase === 'showdown'
  SPOT_ORDER.forEach((kind: UthSpotKind, i) => {
    const amount = game.bets[kind]
    if (amount <= 0) return
    const s = SPOTS[kind]
    const at: [number, number] = [s.x, s.y]
    const r = done ? game.resolutions.find((x) => x.kind === kind) : undefined
    items.push({ key: `${round}:bet:${kind}`, amount, at, swept: r?.effect === 'lose', delay: 0.3 + i * 0.1, seed: i * 7 + 3 })
    if (r?.effect === 'win' && r.net > 0) {
      items.push({
        key: `${round}:pay:${kind}`,
        amount: r.net,
        at: [at[0] + SIZE * 0.95, at[1] - 6],
        from: [TRAY.x + (i - 1.5) * 60, TRAY.y + 20],
        delay: 0.5 + i * 0.14,
        seed: i * 11 + 40,
      })
    }
  })
  return items
}

/** Chips in the circles: they stand through the hand, then the losers are raked and the winners paid. */
export const BetLayer = memo(function BetLayer() {
  const game = useUthStore((s) => s.game)
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

function useSettleSounds(game: UthState) {
  const phase = useRef(game.phase)
  useEffect(() => {
    const was = phase.current
    phase.current = game.phase
    if (game.phase !== 'showdown' || was === 'showdown') return
    if (game.resolutions.some((r) => r.effect === 'lose')) play('chipSlide', { at: 0.35 })
    const paid = game.resolutions.filter((r) => r.effect === 'win').length
    for (let i = 0; i < Math.min(paid, 4); i++) play('chipStack', { at: 0.6 + i * 0.14, count: 5 })
  }, [game.phase, game.resolutions])
}
