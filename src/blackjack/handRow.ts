import { chipBreakdown } from '../components/chips'
import { PER_COLUMN, THICKNESS } from '../components/ChipStack'
import { isNatural } from '../engine/hand'
import type { RoundState } from '../engine/types'
import { BET_Y, CAMERA, DEALT, PAYOUT_Y, PLANE, STACK_SIZE, STAGE } from './geometry'

/**
 * Where the player's cards lie: just beyond the chips in front of them.
 *
 * Chips stand up off the felt, and from a seated player's angle a stack hides
 * the felt behind it, further back the taller it is. A hand laid at a fixed
 * depth is either buried under a tall bet or left stranded behind a short
 * one, so the row is set from the tallest stack its boxes will stand this
 * round, with a strip of felt left showing between the two.
 *
 * The payout counts too: it is set down beside the bet, under the same cards,
 * and a blackjack's three-to-two or a doubled win can take more chips than the
 * bet did. Both are known as soon as the cards are (a natural from the deal, a
 * double from the moment it is made), so the row is settled before the money
 * moves and the cards never shuffle about when the hand is paid.
 */

/** Felt left showing between a hand's lowest card and the top of the chips in front of it. */
const CLEARANCE = 8

/** How far the lowest corner of a hand reaches below the row: half a card, and a little for the fan's turn. */
const REACH = DEALT.h / 2 + 2

const COS = Math.cos((CAMERA.tilt * Math.PI) / 180)
const SIN = Math.sin((CAMERA.tilt * Math.PI) / 180)

/**
 * The eye, where CSS puts it: `perspective` in front of the middle of the
 * stage. Heights and distances below are in stage pixels, toward the viewer
 * for z, as BlackjackView's camera places the plane.
 */
const EYE = { y: STAGE.h / 2, d: CAMERA.perspective }

/** A depth on the plane, as the height and distance it is tilted to. */
function onFelt(py: number): { y: number; z: number } {
  const v = py - PLANE.h / 2
  return { y: CAMERA.cy + v * COS, z: CAMERA.z + v * SIN }
}

/**
 * How far back across the felt a bet of `amount`, standing at depth `y`,
 * hides it from your seat: the depth that lands on screen level with the top
 * of its top chip. ChipStack draws a stack as an upright picture facing you,
 * rising from the stack's front edge with a full chip face on top.
 */
function stackTop(y: number, amount: number): number {
  const chips = Math.min(Math.max(1, chipBreakdown(amount).length), PER_COLUMN)
  const r = STACK_SIZE / 2
  const standing = 2 * r * COS + chips * STACK_SIZE * THICKNESS * SIN + 1
  const foot = onFelt(y + r)
  // Seen through the eye, the top of the picture...
  const top = EYE.y + ((foot.y - standing - EYE.y) * EYE.d) / (EYE.d - foot.z)
  // ...and the depth on the felt seen in line with it.
  const centre = onFelt(PLANE.h / 2)
  const v = ((top - EYE.y) * (EYE.d - centre.z) - (centre.y - EYE.y) * EYE.d) / (COS * EYE.d + (top - EYE.y) * SIN)
  return PLANE.h / 2 + v
}

/** The depth, in plane pixels, of the centre of the first card of every box this round. */
export function playerRowY(round: RoundState, blackjackPayout: number): number {
  // Never nearer the circle than a single chip allows, so a lone chip and an
  // empty circle look the same.
  let top = stackTop(BET_Y, 0)
  for (const hand of round.hands) {
    const bet = hand.doubled ? hand.bet / 2 : hand.bet
    // What a win sets down beside it (see Bets.tsx): even money, the
    // blackjack price on a natural, and both halves of a double.
    const winnings = hand.doubled ? hand.bet : isNatural(hand) ? bet * blackjackPayout : bet
    top = Math.min(top, stackTop(BET_Y, bet), stackTop(PAYOUT_Y, winnings))
  }
  return top - CLEARANCE - REACH
}
