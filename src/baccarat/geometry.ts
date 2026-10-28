import { CARD, TABLE } from '../blackjack/geometry'
import { ARC_CY } from '../components/tableArc'
import type { BaccaratBetKind } from '../engine/baccarat/types'

/**
 * The mini-baccarat layout, on the blackjack plane.
 *
 * The dealer's half holds two card boxes, Player on the left and Banker on the
 * right, where the coup is turned over. The player's half is the apron: the
 * two main bets as bands across the felt, Player nearest you as it is printed
 * on every Strip layout, and above them a row of the smaller bets — the Tie in
 * the middle, the pairs either side of it, the Dragon Bonus at each end.
 */

export const HAND = {
  player: { x: 575, y: 250 },
  banker: { x: 925, y: 250 },
} as const

/** Where a card sits: two side by side, and the tableau's third card sideways beneath them. */
export function cardSpot(side: 'player' | 'banker', index: number): { x: number; y: number; spin: number } {
  const { x, y } = HAND[side]
  if (index < 2) return { x: x + (index === 0 ? -64 : 64), y: y - index * 3, spin: index === 0 ? -1.5 : 1.5 }
  return { x, y: y + CARD.h / 2 + 12 + CARD.w / 2, spin: 90 }
}

/** The outline each hand is turned over inside. */
export const BOX = { w: 290, top: 156, bottom: 478 } as const

/** Running totals stand beside each box. */
export const TOTAL = {
  player: { x: HAND.player.x - BOX.w / 2 - 34, y: 330 },
  banker: { x: HAND.banker.x + BOX.w / 2 + 34, y: 330 },
} as const

export type SpotShape =
  | { type: 'band'; r0: number; r1: number; spread: number }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'oval'; cx: number; cy: number; rx: number; ry: number }

export interface BetSpot {
  kind: BaccaratBetKind
  shape: SpotShape
  /** Printed on the felt. */
  label: string
  sub: string
}

const ROW_Y = 520

export const SPOTS: BetSpot[] = [
  { kind: 'player', shape: { type: 'band', r0: 905, r1: 975, spread: 14 }, label: 'PLAYER', sub: 'PAYS 1 TO 1' },
  { kind: 'banker', shape: { type: 'band', r0: 820, r1: 890, spread: 15 }, label: 'BANKER', sub: 'PAYS 19 TO 20' },
  { kind: 'tie', shape: { type: 'oval', cx: TABLE.cx, cy: ROW_Y, rx: 74, ry: 44 }, label: 'TIE', sub: '8 TO 1' },
  { kind: 'playerPair', shape: { type: 'circle', cx: 590, cy: ROW_Y, r: 44 }, label: 'P PAIR', sub: '11 TO 1' },
  { kind: 'bankerPair', shape: { type: 'circle', cx: 910, cy: ROW_Y, r: 44 }, label: 'B PAIR', sub: '11 TO 1' },
  { kind: 'dragonPlayer', shape: { type: 'circle', cx: 450, cy: ROW_Y, r: 44 }, label: 'DRAGON', sub: 'PLAYER' },
  { kind: 'dragonBanker', shape: { type: 'circle', cx: 1050, cy: ROW_Y, r: 44 }, label: 'DRAGON', sub: 'BANKER' },
]

export function spotFor(kind: BaccaratBetKind): BetSpot {
  return SPOTS.find((s) => s.kind === kind)!
}

function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [TABLE.cx + r * Math.sin(a), ARC_CY + r * Math.cos(a)]
}

export function shapePath(shape: SpotShape): string {
  switch (shape.type) {
    case 'band': {
      const { r0, r1, spread } = shape
      const [ax, ay] = polar(r1, -spread)
      const [bx, by] = polar(r1, spread)
      const [cx, cy] = polar(r0, spread)
      const [dx, dy] = polar(r0, -spread)
      return `M ${ax} ${ay} A ${r1} ${r1} 0 0 0 ${bx} ${by} L ${cx} ${cy} A ${r0} ${r0} 0 0 1 ${dx} ${dy} Z`
    }
    case 'circle':
      return `M ${shape.cx - shape.r} ${shape.cy} a ${shape.r} ${shape.r} 0 1 0 ${shape.r * 2} 0 a ${shape.r} ${shape.r} 0 1 0 ${-shape.r * 2} 0`
    case 'oval':
      return `M ${shape.cx - shape.rx} ${shape.cy} a ${shape.rx} ${shape.ry} 0 1 0 ${shape.rx * 2} 0 a ${shape.rx} ${shape.ry} 0 1 0 ${-shape.rx * 2} 0`
  }
}

/** Where the chips on a bet stand. */
export function anchorFor(kind: BaccaratBetKind): [number, number] {
  const { shape } = spotFor(kind)
  if (shape.type === 'band') return [TABLE.cx, ARC_CY + (shape.r0 + shape.r1) / 2 + 4]
  return [shape.cx, shape.cy + 4]
}

/** The text arc through the middle of a band. */
export function bandTextArc(shape: Extract<SpotShape, { type: 'band' }>, inset = 0): string {
  const r = (shape.r0 + shape.r1) / 2 + inset
  const [ax, ay] = polar(r, -shape.spread)
  const [bx, by] = polar(r, shape.spread)
  return `M ${ax} ${ay} A ${r} ${r} 0 0 0 ${bx} ${by}`
}
