/**
 * The blackjack table, in plane pixels.
 *
 * The table is laid out flat on a 1500×860 plane and then tilted away from the
 * viewer, the way a seated player sees it: the dealer's straight edge at the
 * top and far away, the padded rail curving round at the bottom and close.
 * Everything that sits on the felt — cards, chips, the betting circle, the
 * shoe — is positioned in these coordinates, so nothing is ever measured
 * twice.
 */

export const STAGE = { w: 1600, h: 900 } as const

export const PLANE = { w: 1500, h: 860 } as const

/** How far the felt leans back, and from how far away it is seen. */
export const CAMERA = {
  tilt: 32,
  perspective: 1500,
  /** Plane centre, in stage pixels. */
  cx: 800,
  cy: 452,
  /** Pushed back so nothing near the lens is magnified past 1:1. */
  z: -100,
} as const

/** The D: a straight dealer's edge, and a half-ellipse round the players. */
export const TABLE = {
  cx: 750,
  /** The dealer's straight edge. */
  edgeY: 64,
  /** Outer radii of the rail. */
  rx: 690,
  ry: 780,
  /** Width of the padded armrest. */
  rail: 62,
} as const

export const FELT = {
  rx: TABLE.rx - TABLE.rail,
  ry: TABLE.ry - TABLE.rail,
} as const

/**
 * A card at full size: what the other tables scale theirs from, and what the
 * shoe and the discard rack are built to hold.
 */
export const CARD = { w: 150, h: 210 } as const

/**
 * Blackjack deals a touch under that. The felt is there to hold the game, and
 * a heads-up table has a lot of it, so the cards, chips and circle are sized
 * to fill it rather than to leave room for six other players who are never
 * coming; but a hand has to lie clear of the chips standing in front of it
 * (see handRow.ts), and the printing leaves only so much room behind it.
 */
export const CARD_SCALE = 0.9

/** A blackjack card as it lies on the felt. */
export const DEALT = { w: CARD.w * CARD_SCALE, h: CARD.h * CARD_SCALE } as const

/** The shoe and the discard rack, each sized to hold cards this big. */
export const SHOE = { x: 1192, y: 192, angle: -20, w: 156, d: 240, h: 80 } as const
export const DISCARD = { x: 306, y: 190, angle: 20 } as const
export const TRAY = { x: 750, y: 100, w: 540, h: 66 } as const

export const DEALER_ROW = { x: 750, y: 237 } as const
export const BET_Y = 712
/** A winning box's payout is set down beside its bet, a little further back. */
export const PAYOUT_Y = BET_Y - 4
/** The diameter of a chip in a stack on the felt. */
export const STACK_SIZE = 76
export const CIRCLE = { x: 750, y: BET_Y, r: 60 } as const
/** Where insurance is placed: on the insurance line, to the player's right. */
export const INSURANCE_SPOT = { x: 1040, y: 412 } as const

/** A fan's widest spread and the step between its cards: the dealer's, and a box's (closer when three or four share the row). */
export const DEALER_FAN = { width: 522, step: 97 } as const
export function handFan(boxes: number): { width: number; step: number } {
  return boxes > 2 ? { width: 221, step: 54 } : { width: 378, step: 94 }
}

/** Horizontal centres for 1–4 boxes, spreading as a split adds hands. */
export function handCenters(count: number): number[] {
  if (count <= 1) return [TABLE.cx]
  const gap = count === 2 ? 350 : count === 3 ? 290 : 250
  const span = gap * (count - 1)
  return Array.from({ length: count }, (_, i) => TABLE.cx - span / 2 + i * gap)
}

export interface CardSpot {
  x: number
  y: number
  /** Rotation about the felt's normal, degrees. */
  spin: number
}

/**
 * A hand fanned left to right, each card rising a little and turned a degree
 * or two, so the corner index of every card stays readable and the spread
 * never looks printed. Long hands close up rather than run off the felt.
 */
export function fan(count: number, cx: number, cy: number, maxWidth = 378, maxStep = 94): CardSpot[] {
  const step = count <= 1 ? 0 : Math.min(maxStep, (maxWidth - DEALT.w) / (count - 1))
  const span = step * (count - 1)
  return Array.from({ length: count }, (_, i) => ({
    x: cx - span / 2 + i * step,
    y: cy - i * 5,
    spin: (i - (count - 1) / 2) * 2.2,
  }))
}

/**
 * The felt's half-width at a given depth — used to keep split hands inside
 * the rail.
 */
export function feltHalfWidthAt(y: number): number {
  const dy = y - TABLE.edgeY
  if (dy < 0 || dy > FELT.ry) return 0
  return FELT.rx * Math.sqrt(1 - (dy / FELT.ry) ** 2)
}
