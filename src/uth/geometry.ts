import { CARD } from '../blackjack/geometry'

/**
 * Ultimate Texas Hold'em on the D table, in the blackjack plane's pixels: the
 * dealer's two cards under the tray with a pay table either side of them, the
 * five-card board across the middle, and your two cards below it, cupped by
 * your four circles — Trips and Ante to the left, Blind and Play to the right.
 *
 * Seven cards across the felt is more than blackjack ever puts down, so the
 * cards here are dealt a little smaller.
 */

export const CARD_SCALE = 0.84

export type UthSpotKind = 'trips' | 'ante' | 'blind' | 'play'

export const SPOTS: Record<UthSpotKind, { x: number; y: number; r: number; label: string }> = {
  trips: { x: 434, y: 586, r: 44, label: 'TRIPS' },
  ante: { x: 560, y: 678, r: 46, label: 'ANTE' },
  blind: { x: 940, y: 678, r: 46, label: 'BLIND' },
  play: { x: 1066, y: 586, r: 46, label: 'PLAY' },
}

export const SPOT_ORDER: UthSpotKind[] = ['trips', 'ante', 'blind', 'play']

const DEALER_Y = 226
const BOARD_Y = 424
const PLAYER_Y = 612
const PAIR_GAP = 138
const BOARD_GAP = 138

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

/** Where each hand's name stands, centred on the hand. */
export const LABELS = {
  /** Over the dealer's cards, on the tray, clear of the pay tables either side. */
  dealer: { x: 750, y: DEALER_Y - (CARD.h * CARD_SCALE) / 2 - 2 },
  /** Under your cards, between Ante and Blind, where a long hand name stays clear of the chips. */
  player: { x: 750, y: PLAYER_Y + (CARD.h * CARD_SCALE) / 2 + 56 },
}

/** The two pay tables, either side of the dealer's cards, and the tray between them narrowed to clear them. */
export const PAY_TABLES = {
  blind: { x0: 200, x1: 410, y: 152 },
  trips: { x0: 940, x1: 1138, y: 152 },
}
export const TRAY_WIDTH = 470

/**
 * The shuffler, out at the far corner of the dealer's edge to leave the Trips
 * table room; cards come out of its mouth and go back in.
 */
export const SHUFFLER = { x: 1236, y: 196, angle: -20 } as const
export const SHUFFLER_MOUTH = { x: SHUFFLER.x - 34, y: SHUFFLER.y + 70, angle: SHUFFLER.angle }
