import { motion, useAnimate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { play } from '../audio'
import { angleBetween, cardAt, cardLift, cardTurn, shadowAt } from './feltMotion'
import type { DealtCard } from '../engine/types'
import type { CardBack } from '../prefs/prefsStore'
import { CardBackFace, CardFace } from './PlayingCard'

/**
 * One card on a tilted felt, dealt the way the blackjack table deals: out of
 * the shoe face down, arcing up toward the viewer, turning over as it lands if
 * it lands face up — and turning over later, lifted clear of the felt, when
 * the game turns it. Shares the blackjack card's markup and styles, so a card
 * is the same object at every table.
 */

export interface CardPlace {
  x: number
  y: number
  /** Rotation about the felt's normal, degrees. A baccarat third card lies at 90. */
  spin: number
  /** Stacking order within its hand; later cards sit on top. */
  order: number
}

export interface CardOrigin {
  x: number
  y: number
  angle: number
}

const EASE_PITCH: [number, number, number, number] = [0.18, 0.72, 0.22, 1]

export function FeltCard({
  card,
  place,
  from,
  away,
  delay,
  flight,
  back,
  dim = false,
  lit = false,
}: {
  card: DealtCard
  place: CardPlace
  /** Where it is dealt from. */
  from: CardOrigin
  /** Where it is raked to when the hand is cleared. */
  away: CardOrigin
  /** Seconds to wait before leaving the shoe. */
  delay: number
  /** Seconds in the air. */
  flight: number
  back: CardBack
  /** Played no part: dimmed once the hand is read. */
  dim?: boolean
  /** One of the cards that make the hand. */
  lit?: boolean
}) {
  const { x, y, spin, order } = place
  const [entryDelay] = useState(delay)
  const [landed, setLanded] = useState(false)
  const [flipScope, animateFlip] = useAnimate<HTMLDivElement>()
  const shownDown = useRef(true)
  const rest = order * 0.9

  useEffect(() => {
    shownDown.current = card.faceDown
    play('card', { at: entryDelay })
    if (!card.faceDown) {
      void animateFlip(
        flipScope.current,
        { transform: cardTurn(0) },
        { delay: entryDelay + flight * 0.12, duration: flight * 0.78, ease: 'easeInOut' },
      )
    }
    // Mount only — every later change of face is a turn, handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (shownDown.current === card.faceDown) return
    shownDown.current = card.faceDown
    play('cardFlip')
    const [turnFrom, turnTo] = card.faceDown ? [0, 180] : [180, 0]
    void animateFlip(
      flipScope.current,
      { transform: [cardTurn(turnFrom), cardTurn((turnFrom + turnTo) / 2, 74), cardTurn(turnTo)] },
      { duration: 0.52, ease: [0.45, 0, 0.25, 1] },
    )
  }, [card.faceDown, animateFlip, flipScope])

  const move = landed ? { duration: 0.42, ease: EASE_PITCH } : { duration: flight, delay: entryDelay, ease: EASE_PITCH }

  return (
    <motion.div
      className="bj-card"
      initial={{ transform: cardAt(from.x, from.y - 20) }}
      animate={{ transform: cardAt(x, y) }}
      exit={{ transform: cardAt(away.x, away.y), transition: { duration: 0.55, delay: order * 0.03, ease: [0.5, 0, 0.3, 1] } }}
      transition={move}
      onAnimationComplete={() => setLanded(true)}
    >
      <motion.div
        className="bj-card__shadow"
        initial={{ opacity: 0, transform: shadowAt(1.25, 0) }}
        animate={{ opacity: 1, transform: shadowAt(1, spin) }}
        exit={{ opacity: 0, transition: { duration: 0.4 } }}
        transition={landed ? { duration: 0.4 } : { duration: flight, delay: entryDelay }}
      />
      <motion.div
        className="bj-card__spin"
        initial={{ transform: cardLift(60, from.angle) }}
        animate={{
          transform: landed
            ? cardLift(rest, spin)
            : [cardLift(60, from.angle), cardLift(118, angleBetween(from.angle, spin)), cardLift(rest, spin)],
        }}
        exit={{
          transform: [cardLift(rest, spin), cardLift(26, angleBetween(spin, away.angle), 0.93), cardLift(4, away.angle, 0.86)],
          transition: { duration: 0.55, delay: order * 0.03 },
        }}
        transition={
          landed ? { duration: 0.42 } : { duration: flight, delay: entryDelay, times: [0, 0.42, 1], ease: ['easeOut', EASE_PITCH] }
        }
      >
        <motion.div ref={flipScope} className="bj-card__flip" initial={{ transform: cardTurn(180) }}>
          <div className={`bj-card__face bj-card__face--front${dim ? ' is-dim' : ''}${lit ? ' is-lit' : ''}`}>
            <CardFace rank={card.rank} suit={card.suit} />
          </div>
          <div className="bj-card__face bj-card__face--back">
            <CardBackFace theme={back} />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
