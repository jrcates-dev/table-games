import { AnimatePresence, motion } from 'motion/react'
import { memo, type ReactNode } from 'react'
import { evaluate, formatTotal, isNatural } from '../engine/hand'
import type { Outcome, RoundState } from '../engine/types'
import { signedMoney } from '../lib/format'
import { CAMERA, CARD, DEALER_FAN, DEALER_ROW, fan, handCenters, handFan, PLAYER_ROW_Y } from './geometry'

/**
 * Labels that stand up off the felt: running totals beside each hand while it
 * is live, and the result above it once the round is settled. Stood upright
 * toward the viewer rather than printed flat, so they read at any tilt.
 */

function Billboard({ x, y, children, lift = 0 }: { x: number; y: number; children: ReactNode; lift?: number }) {
  return (
    <div className="bj-billboard" style={{ left: x, top: y }}>
      <div className="bj-billboard__stand" style={{ transform: `translateX(-50%) rotateX(${-CAMERA.tilt}deg) translateY(${-lift}px)` }}>
        {children}
      </div>
    </div>
  )
}

const OUTCOME: Record<Outcome, { label: string; tone: 'gold' | 'win' | 'push' | 'lose' }> = {
  blackjack: { label: 'Blackjack', tone: 'gold' },
  win: { label: 'Win', tone: 'win' },
  push: { label: 'Push', tone: 'push' },
  lose: { label: 'Lose', tone: 'lose' },
  bust: { label: 'Bust', tone: 'lose' },
  surrender: { label: 'Surrendered', tone: 'push' },
  dealerBlackjack: { label: 'Dealer blackjack', tone: 'lose' },
}

export const Badges = memo(function Badges({ round, showTotals }: { round: RoundState; showTotals: boolean }) {
  const over = round.phase === 'roundOver'
  const centers = handCenters(round.hands.length)
  const roundKey = round.hands[0]?.id ?? 'none'

  const dealerFan = fan(round.dealer.length, DEALER_ROW.x, DEALER_ROW.y, DEALER_FAN.width, DEALER_FAN.step)
  const hidden = round.dealer.some((c) => c.faceDown)
  const dealerValue = evaluate(round.dealer.filter((c) => !c.faceDown))
  const dealerBust = !hidden && evaluate(round.dealer).busted
  const dealerNatural = !hidden && round.dealer.length === 2 && evaluate(round.dealer).total === 21
  const lastDealer = dealerFan[dealerFan.length - 1]
  const box = handFan(round.hands.length)

  return (
    <AnimatePresence>
      {showTotals && round.dealer.length > 0 && round.phase !== 'dealing' && lastDealer && (
        <Billboard key={`${roundKey}:dealer`} x={lastDealer.x + CARD.w / 2 + 58} y={DEALER_ROW.y + 18}>
          <motion.div
            className={`total-pill total-pill--dealer${dealerBust ? ' is-bust' : ''}${dealerNatural ? ' is-natural' : ''}`}
            initial={{ opacity: 0, transform: 'scale(0.7)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0 }}
          >
            <span className="total-pill__who">Dealer</span>
            <strong className="num">{dealerNatural ? 'BJ' : hidden ? dealerValue.total : dealerBust ? `${evaluate(round.dealer).total} · Bust` : formatTotal(round.dealer)}</strong>
          </motion.div>
        </Billboard>
      )}

      {round.hands.map((hand, i) => {
        if (hand.cards.length === 0) return null
        const spots = fan(hand.cards.length, centers[i], PLAYER_ROW_Y, box.width, box.step)
        const last = spots[spots.length - 1]
        const value = evaluate(hand.cards)
        const active = round.phase === 'playerTurn' && i === round.activeHandIndex
        const natural = isNatural(hand)

        if (over && hand.outcome) {
          const o = OUTCOME[hand.outcome]
          const net = (hand.payout ?? 0) - hand.bet
          return (
            <Billboard key={`${roundKey}:${hand.id}:result`} x={centers[i]} y={PLAYER_ROW_Y - CARD.h / 2 - 6}>
              <motion.div
                className={`result-tag result-tag--${o.tone}`}
                initial={{ opacity: 0, transform: 'translateY(16px) scale(0.8)' }}
                animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
                exit={{ opacity: 0, transform: 'translateY(-10px) scale(1)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.1 + i * 0.12 }}
              >
                <span className="result-tag__label">{o.label}</span>
                <span className="result-tag__total num">{natural ? '21' : formatTotal(hand.cards)}</span>
                {net !== 0 && <strong className="result-tag__net num">{signedMoney(net)}</strong>}
              </motion.div>
            </Billboard>
          )
        }

        if (!showTotals || round.phase === 'dealing') return null
        // Beside a lone hand; over each box once it is split, where a total
        // beside one hand would stand on the next box's cards.
        const split = round.hands.length > 1
        return (
          <Billboard
            key={`${roundKey}:${hand.id}:total`}
            x={split ? centers[i] : last.x + CARD.w / 2 + 46}
            y={split ? PLAYER_ROW_Y - CARD.h / 2 - 6 : PLAYER_ROW_Y + 12}
          >
            <motion.div
              className={`total-pill${active ? ' is-active' : ''}${value.busted ? ' is-bust' : ''}${value.total === 21 ? ' is-21' : ''}${natural ? ' is-natural' : ''}`}
              initial={{ opacity: 0, transform: 'scale(0.7)' }}
              animate={{ opacity: 1, transform: 'scale(1)' }}
              exit={{ opacity: 0 }}
            >
              {split && <span className="total-pill__who">Hand {i + 1}</span>}
              <strong className="num">{natural ? 'BJ' : value.busted ? `${value.total} · Bust` : formatTotal(hand.cards)}</strong>
            </motion.div>
          </Billboard>
        )
      })}
    </AnimatePresence>
  )
})

/** A soft glow under the hand being played, when there is more than one. */
export function ActiveHandGlow({ round }: { round: RoundState }) {
  if (round.phase !== 'playerTurn' || round.hands.length < 2) return null
  const centers = handCenters(round.hands.length)
  const x = centers[round.activeHandIndex]
  return (
    <motion.div
      className="bj-active-glow"
      initial={false}
      animate={{ x, y: PLAYER_ROW_Y + CARD.h / 2 + 30 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
    />
  )
}
