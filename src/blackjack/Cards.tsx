import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { memo, useEffect, useRef, useState } from 'react'
import { play } from '../audio'
import { CardBackFace, CardFace } from '../components/PlayingCard'
import type { DealtCard, RoundState } from '../engine/types'
import type { CardBack } from '../prefs/prefsStore'
import { DEALER_ROW, DISCARD, fan, handCenters, PLAYER_ROW_Y, SHOE } from './geometry'

/**
 * Every card on the felt.
 *
 * Cards are keyed by their physical identity within the round, so a card that
 * moves — the second card of a split pair walking to its new box — slides
 * there rather than vanishing and reappearing. Each card leaves the shoe face
 * down, arcs up toward the viewer and turns over as it lands, exactly as a
 * dealer pitches it; the hole card waits face down until the reveal, which
 * lifts it off the felt so it can turn without passing through the table.
 */

interface Placed {
  card: DealtCard
  x: number
  y: number
  spin: number
  /** Stacking order within its hand; later cards sit on top. */
  order: number
  dim: boolean
  /** The dealer lifts a corner of the hole card to check for blackjack. */
  peek?: boolean
}

function layoutCards(round: RoundState, dealerPeek: boolean): Placed[] {
  const placed: Placed[] = []
  const dealerFan = fan(round.dealer.length, DEALER_ROW.x, DEALER_ROW.y, 440, 76)
  const up = round.dealer[0]?.rank
  // An ace or a ten showing: the dealer checks underneath before anyone acts.
  // After any insurance decision, as a real dealer does.
  const peeks =
    dealerPeek &&
    round.phase !== 'dealing' &&
    round.phase !== 'insurance' &&
    (up === 'A' || up === '10' || up === 'J' || up === 'Q' || up === 'K')
  round.dealer.forEach((card, i) =>
    placed.push({ card, ...dealerFan[i], order: i, dim: false, peek: peeks && i === 1 && card.faceDown }),
  )

  const centers = handCenters(round.hands.length)
  const acting = round.phase === 'playerTurn' && round.hands.length > 1
  round.hands.forEach((hand, h) => {
    const spots = fan(hand.cards.length, centers[h], PLAYER_ROW_Y, round.hands.length > 2 ? 232 : 300)
    hand.cards.forEach((card, i) =>
      placed.push({ card, ...spots[i], order: i, dim: acting && h !== round.activeHandIndex }),
    )
  })
  return placed
}

export const CardLayer = memo(function CardLayer({
  round,
  dealerPeek,
  interval,
  flight,
  back,
}: {
  round: RoundState
  dealerPeek: boolean
  /** Seconds between cards in the opening deal. */
  interval: number
  /** Seconds a card spends in the air. */
  flight: number
  back: CardBack
}) {
  const roundKey = round.hands[0]?.id ?? 'none'
  const placed = layoutCards(round, dealerPeek)
  const staggering = round.phase === 'dealing'

  return (
    <AnimatePresence>
      {placed.map((p) => (
        <TableCard
          key={`${roundKey}:${p.card.id}`}
          placed={p}
          delay={staggering ? p.card.seq * interval : 0}
          flight={flight}
          back={back}
        />
      ))}
    </AnimatePresence>
  )
})

const EASE_PITCH: [number, number, number, number] = [0.18, 0.72, 0.22, 1]

function TableCard({ placed, delay, flight, back }: { placed: Placed; delay: number; flight: number; back: CardBack }) {
  const { card, x, y, spin, order, dim } = placed
  // The opening deal staggers each card by its place in the deal; anything
  // after that (a split box re-spacing) moves immediately.
  const [entryDelay] = useState(delay)
  const [landed, setLanded] = useState(false)
  const [flipScope, animateFlip] = useAnimate<HTMLDivElement>()
  const shownDown = useRef(true)
  const rest = order * 0.9

  useEffect(() => {
    // Leaves the shoe face down; turns over in the air unless it is the hole card.
    shownDown.current = card.faceDown
    if (!card.faceDown) {
      void animateFlip(
        flipScope.current,
        { rotateY: 0 },
        { delay: entryDelay + flight * 0.12, duration: flight * 0.78, ease: 'easeInOut' },
      )
    }
    // Mount only — every later change of face is a reveal, handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The peek: a corner of the hole card lifts and settles again.
  const peeked = useRef(false)
  useEffect(() => {
    if (!placed.peek || peeked.current) return
    peeked.current = true
    void animateFlip(flipScope.current, { rotateX: [0, -16, 0], z: [0, 24, 0] }, { duration: 0.75, delay: 0.1, ease: 'easeInOut' })
  }, [placed.peek, animateFlip, flipScope])

  useEffect(() => {
    if (shownDown.current === card.faceDown) return
    shownDown.current = card.faceDown
    play('cardFlip')
    void animateFlip(
      flipScope.current,
      { rotateY: card.faceDown ? 180 : 0, z: [0, 74, 0] },
      { duration: 0.52, ease: [0.45, 0, 0.25, 1] },
    )
  }, [card.faceDown, animateFlip, flipScope])

  const move = landed ? { duration: 0.42, ease: EASE_PITCH } : { duration: flight, delay: entryDelay, ease: EASE_PITCH }

  return (
    <motion.div
      className="bj-card"
      initial={{ x: SHOE.x, y: SHOE.y - 20 }}
      animate={{ x, y }}
      exit={{
        x: DISCARD.x,
        y: DISCARD.y,
        transition: { duration: 0.55, delay: order * 0.03, ease: [0.5, 0, 0.3, 1] },
      }}
      transition={move}
      onAnimationComplete={() => setLanded(true)}
    >
      <motion.div
        className="bj-card__shadow"
        initial={{ opacity: 0, scale: 1.25 }}
        animate={{ opacity: 1, scale: 1, rotate: spin }}
        exit={{ opacity: 0, transition: { duration: 0.4 } }}
        transition={landed ? { duration: 0.4 } : { duration: flight, delay: entryDelay }}
      />
      {/* No opacity on anything with 3D children: it flattens them in Chrome,
          and a flattened card shows both of its faces at once. */}
      <motion.div
        className="bj-card__spin"
        initial={{ rotateZ: SHOE.angle, z: 60 }}
        animate={{ rotateZ: spin, z: [null, 118, rest] }}
        exit={{
          rotateZ: DISCARD.angle,
          z: [null, 26, 4],
          scale: 0.86,
          transition: { duration: 0.55, delay: order * 0.03 },
        }}
        transition={
          landed
            ? { duration: 0.42 }
            : { duration: flight, delay: entryDelay, ease: EASE_PITCH, z: { duration: flight, delay: entryDelay, times: [0, 0.42, 1] } }
        }
      >
        <motion.div ref={flipScope} className="bj-card__flip" initial={{ rotateY: 180 }}>
          <div className={`bj-card__face bj-card__face--front${dim ? ' is-dim' : ''}`}>
            <CardFace rank={card.rank} suit={card.suit} />
          </div>
          <div className={`bj-card__face bj-card__face--back${dim ? ' is-dim' : ''}`}>
            <CardBackFace theme={back} />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
