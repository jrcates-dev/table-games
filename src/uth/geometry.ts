import { SHOE } from '../blackjack/geometry'

/**
 * Ultimate Texas Hold'em on the D table, in the blackjack plane's pixels: the
 * dealer's two cards under the tray, the five-card board across the middle,
 * your two cards below it, and your four circles — Trips, Ante, Blind, Play —
 * in an arc along the rail.
 *
 * Seven cards across the felt is more than blackjack ever puts down, so the
 * cards here are dealt a little smaller.
 */

export const CARD_SCALE = 0.82

export type UthSpotKind = 'trips' | 'ante' | 'blind' | 'play'

export const SPOTS: Record<UthSpotKind, { x: number; y: number; r: number; label: string }> = {
  trips: { x: 556, y: 644, r: 40, label: 'TRIPS' },
  ante: { x: 676, y: 698, r: 43, label: 'ANTE' },
  blind: { x: 824, y: 698, r: 43, label: 'BLIND' },
  play: { x: 944, y: 644, r: 43, label: 'PLAY' },
}

export const SPOT_ORDER: UthSpotKind[] = ['trips', 'ante', 'blind', 'play']

const DEALER_Y = 212
const BOARD_Y = 372
const PLAYER_Y = 532
const PAIR_GAP = 116
const BOARD_GAP = 110

/** Where a card lies, in plane pixels. */
export function dealerSpot(i: number): [number, number] {
  return [750 + (i - 0.5) * PAIR_GAP, DEALER_Y]
}

export function boardSpot(i: number): [number, number] {
  return [750 + (i - 2) * BOARD_GAP, BOARD_Y]
}

export function playerSpot(i: number): [number, number] {
  return [750 + (i - 0.5) * PAIR_GAP, PLAYER_Y]
}

/** Where each hand's name stands: its right edge just clear of the hand's first card. */
export const LABELS = {
  dealer: { x: 750 - PAIR_GAP / 2 - 70, y: DEALER_Y + 30 },
  player: { x: 750 - PAIR_GAP / 2 - 70, y: PLAYER_Y + 30 },
}

/** The shuffler sits where the blackjack shoe does; cards come out of its mouth and go back in. */
export const SHUFFLER = SHOE
export const SHUFFLER_MOUTH = { x: SHOE.x - 34, y: SHOE.y + 70, angle: SHOE.angle }
