import { CARD } from '../blackjack/geometry'

/**
 * Pai Gow on the D table, in the blackjack plane's pixels: the dealer's seven
 * under the tray, set into a low hand and a high hand; yours across the middle
 * as they are dealt, and set into the two boxes printed in front of you — the
 * low hand on the left, the high hand on the right, each under the dealer's
 * hand it is played against. Your bet and Fortune circles are on the rail.
 *
 * Fourteen cards on the felt at once is the most of any table in the room, so
 * they are dealt smaller again.
 */

export const CARD_SCALE = 0.72
export const CARD_W = CARD.w * CARD_SCALE
export const CARD_H = CARD.h * CARD_SCALE

export const DEALER_Y = 236
/** Where your seven lie as they are dealt, before any are set. */
export const DEAL_Y = 410
/** The two boxes your hand is set into. */
export const BOX_Y = 574

const STEP = 112
/** The low hand's two slots and the high hand's five, left to right. */
export const LOW_X = [396, 508]
export const HIGH_X = [652, 764, 876, 988, 1100]

/** A card of seven dealt in a row, before it is set. */
export function rowX(i: number): number {
  return 750 + (i - 3) * STEP
}

export type PaiGowSpotKind = 'fortune' | 'wager'

export const SPOTS: Record<PaiGowSpotKind, { x: number; y: number; r: number; label: string }> = {
  fortune: { x: 566, y: 716, r: 44, label: 'FORTUNE' },
  wager: { x: 754, y: 722, r: 52, label: 'BET' },
}

export const SPOT_ORDER: PaiGowSpotKind[] = ['fortune', 'wager']

/** Each hand's name, centred over it. */
export const LABELS = {
  dealerLow: { x: (LOW_X[0] + LOW_X[1]) / 2, y: DEALER_Y - CARD_H / 2 - 2 },
  dealerHigh: { x: HIGH_X[2], y: DEALER_Y - CARD_H / 2 - 2 },
  playerLow: { x: (LOW_X[0] + LOW_X[1]) / 2, y: BOX_Y - CARD_H / 2 - 6 },
  playerHigh: { x: HIGH_X[2], y: BOX_Y - CARD_H / 2 - 6 },
}

/** The shuffler, at the far corner of the dealer's edge, as at hold'em. */
export const SHUFFLER = { x: 1252, y: 196, angle: -20 } as const

/** Upright on a phone the corner is out of the picture: the shuffler stands behind the tray. */
export const UPRIGHT_SHUFFLER = { x: 750, y: -110, angle: 0 } as const

export function shufflerMouth(at: { x: number; y: number; angle: number }) {
  return { x: at.x - 34, y: at.y + 70, angle: at.angle }
}
