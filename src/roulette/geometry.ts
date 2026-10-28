import { allBets, betById, type BetDef } from '../engine/roulette/bets'
import { DOUBLE_ZERO, type Pocket, type WheelType } from '../engine/roulette/wheel'

/**
 * The roulette table, in plane pixels.
 *
 * Seen from a seat on the long side: the wheel set into the table at the left,
 * the layout running away from it to the right with the zeros nearest the
 * wheel, the 3-row at the far edge of the grid and the dozens and even-money
 * boxes nearest you — as every American layout is printed.
 *
 * This is the one place a bet's position is decided. The felt prints from the
 * cells, the click targets are cut from the same lines, and chips sit at the
 * anchors derived from them.
 */

export const STAGE = { w: 1600, h: 900 } as const
export const PLANE = { w: 1500, h: 800 } as const

export const CAMERA = {
  tilt: 22,
  perspective: 2000,
  cx: 650,
  cy: 425,
  z: -380,
} as const

/** Wood, padded rail, felt. */
export const TABLE = { r: 120, rail: 58 } as const

/** The wheel head, set into the table at the left. */
export const WHEEL = {
  cx: 250,
  cy: 390,
  /** The wooden bowl's outer edge. */
  bowl: 212,
  /** The ball track the ball rolls in. */
  track: 188,
  /** Where the spinning head starts. */
  rotor: 160,
  /** Inner edge of the number ring; the pockets lie inside it. */
  numbers: 126,
  /** Inner edge of the pockets; the cone and turret inside. */
  pockets: 96,
  /** Where a ball comes to rest. */
  rest: 111,
} as const

export const GRID = {
  x0: 530,
  zeroW: 64,
  cellW: 64,
  top: 170,
  rowH: 100,
  dozenH: 76,
  evenH: 76,
} as const

/** Left edge of the number columns. */
export const NUM_X0 = GRID.x0 + GRID.zeroW
export const NUM_X1 = NUM_X0 + 12 * GRID.cellW
export const COL_X1 = NUM_X1 + GRID.cellW
export const GRID_BOTTOM = GRID.top + 3 * GRID.rowH
export const DOZEN_BOTTOM = GRID_BOTTOM + GRID.dozenH
export const EVEN_BOTTOM = DOZEN_BOTTOM + GRID.evenH

/** Where losing chips are raked to and winnings come from: the dealer's float, on the far rail. */
export const BANK: [number, number] = [960, 64]
/** The player's rack, just off the near rail. */
export const RACK: [number, number] = [860, 900]

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

const rect = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 })
export const centre = (r: Rect): [number, number] => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]

/** Column 1..12 and row 1..3 of a number; row 1 is the near row (1, 4, 7 …). */
export function cellOf(n: number): { column: number; row: number } {
  return { column: Math.ceil(n / 3), row: ((n - 1) % 3) + 1 }
}

const colX = (column: number) => NUM_X0 + (column - 1) * GRID.cellW
const rowY = (row: number) => GRID.top + (3 - row) * GRID.rowH

/** The printed box of one pocket on the layout. */
export function pocketRect(pocket: Pocket, wheel: WheelType): Rect {
  if (pocket === DOUBLE_ZERO) return rect(GRID.x0, GRID.top, NUM_X0, GRID.top + 1.5 * GRID.rowH)
  if (pocket === 0) return wheel === 'double' ? rect(GRID.x0, GRID.top + 1.5 * GRID.rowH, NUM_X0, GRID_BOTTOM) : rect(GRID.x0, GRID.top, NUM_X0, GRID_BOTTOM)
  const { column, row } = cellOf(pocket)
  return rect(colX(column), rowY(row), colX(column) + GRID.cellW, rowY(row) + GRID.rowH)
}

/** The outside boxes, by bet id. */
export function outsideRect(id: string): Rect | null {
  const [kind, which] = id.split(':')
  const n = Number(which)
  switch (kind) {
    case 'column':
      return rect(NUM_X1, rowY(n), COL_X1, rowY(n) + GRID.rowH)
    case 'dozen':
      return rect(NUM_X0 + (n - 1) * 4 * GRID.cellW, GRID_BOTTOM, NUM_X0 + n * 4 * GRID.cellW, DOZEN_BOTTOM)
  }
  const even = ['low', 'even', 'red', 'black', 'odd', 'high'].indexOf(kind)
  if (even < 0) return null
  return rect(NUM_X0 + even * 2 * GRID.cellW, DOZEN_BOTTOM, NUM_X0 + (even + 1) * 2 * GRID.cellW, EVEN_BOTTOM)
}

// ---------------------------------------------------------------------------
// Click targets
// ---------------------------------------------------------------------------

/** How far either side of a line a click still means the line. */
const EX = 13
const EY = 18

export interface Spot {
  id: string
  /** What a click on this rectangle bets. */
  zone: Rect
  /** Where the chips sit. */
  anchor: [number, number]
  /** Drawn later sits on top: splits over straights, corners over splits. */
  layer: number
}

function insideSpot(def: BetDef, wheel: WheelType): Spot | null {
  const nums = def.numbers
  const hasZero = nums.some((n) => n === 0 || n === DOUBLE_ZERO)
  if (def.kind === 'straight') {
    const r = pocketRect(nums[0], wheel)
    return { id: def.id, zone: r, anchor: centre(r), layer: 0 }
  }
  if (hasZero) return zeroSpot(def, wheel)

  const cells = nums.map(cellOf)
  const cols = [...new Set(cells.map((c) => c.column))]
  const rows = [...new Set(cells.map((c) => c.row))]
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)
  const minRow = Math.min(...rows)
  switch (def.kind) {
    case 'split': {
      if (cols.length === 2) {
        // Side by side along a row: on the line between the columns.
        const x = colX(maxCol)
        const y0 = rowY(minRow)
        return { id: def.id, zone: rect(x - EX, y0 + EY, x + EX, y0 + GRID.rowH - EY), anchor: [x, y0 + GRID.rowH / 2], layer: 1 }
      }
      const y = rowY(minRow)
      const x0 = colX(minCol)
      return { id: def.id, zone: rect(x0 + EX, y - EY, x0 + GRID.cellW - EX, y + EY), anchor: [x0 + GRID.cellW / 2, y], layer: 1 }
    }
    case 'corner': {
      const x = colX(maxCol)
      const y = rowY(minRow)
      return { id: def.id, zone: rect(x - EX, y - EY, x + EX, y + EY), anchor: [x, y], layer: 2 }
    }
    case 'street': {
      const x0 = colX(minCol)
      return { id: def.id, zone: rect(x0 + EX, GRID_BOTTOM - EY, x0 + GRID.cellW - EX, GRID_BOTTOM + 10), anchor: [x0 + GRID.cellW / 2, GRID_BOTTOM], layer: 2 }
    }
    case 'sixLine': {
      const x = colX(maxCol)
      return { id: def.id, zone: rect(x - EX, GRID_BOTTOM - EY, x + EX, GRID_BOTTOM + 10), anchor: [x, GRID_BOTTOM], layer: 3 }
    }
  }
  return null
}

/**
 * The bets that take in a zero, all placed along the line between the zeros
 * and the 1-2-3 column, top to bottom in the order they meet it.
 */
function zeroSpot(def: BetDef, wheel: WheelType): Spot | null {
  const x = NUM_X0
  const key = def.numbers.join('-')
  const r1 = rowY(1)
  const r2 = rowY(2)
  const r3 = rowY(3)
  const mid = GRID.top + 1.5 * GRID.rowH
  // [y0, y1] of each target along the line.
  const bands: Record<string, [number, number]> =
    wheel === 'double'
      ? {
          [`3-${DOUBLE_ZERO}`]: [r3 + EY, r2 - EY],
          [`2-3-${DOUBLE_ZERO}`]: [r2 - EY, r2 + EY],
          [`2-${DOUBLE_ZERO}`]: [r2 + EY, mid - 10],
          [`0-2-${DOUBLE_ZERO}`]: [mid - 10, mid + 10],
          '0-2': [mid + 10, r1 - EY],
          '0-1-2': [r1 - EY, r1 + EY],
          '0-1': [r1 + EY, GRID_BOTTOM - EY],
          [`0-1-2-3-${DOUBLE_ZERO}`]: [GRID_BOTTOM - EY, GRID_BOTTOM + 10],
        }
      : {
          '0-3': [r3 + EY, r2 - EY],
          '0-2-3': [r2 - EY, r2 + EY],
          '0-2': [r2 + EY, r1 - EY],
          '0-1-2': [r1 - EY, r1 + EY],
          '0-1': [r1 + EY, GRID_BOTTOM - EY],
          '0-1-2-3': [GRID_BOTTOM - EY, GRID_BOTTOM + 10],
        }
  if (key === `0-${DOUBLE_ZERO}`) {
    return { id: def.id, zone: rect(GRID.x0 + 8, mid - EY, NUM_X0 - EX, mid + EY), anchor: [(GRID.x0 + NUM_X0) / 2, mid], layer: 1 }
  }
  const band = bands[key]
  if (!band) return null
  const isLine = band[0] === GRID_BOTTOM - EY
  const anchorY = isLine ? GRID_BOTTOM : (band[0] + band[1]) / 2
  return { id: def.id, zone: rect(x - EX, band[0], x + EX, band[1]), anchor: [x, anchorY], layer: def.kind === 'split' ? 2 : 3 }
}

const spotCache: Partial<Record<WheelType, Spot[]>> = {}

/** Every bet's target on this layout, bottom layer first. */
export function spotsFor(wheel: WheelType): Spot[] {
  if (spotCache[wheel]) return spotCache[wheel]!
  const out: Spot[] = []
  for (const def of allBets(wheel)) {
    const r = outsideRect(def.id)
    if (r) {
      out.push({ id: def.id, zone: r, anchor: centre(r), layer: 0 })
      continue
    }
    const spot = insideSpot(def, wheel)
    if (spot) out.push(spot)
  }
  out.sort((a, b) => a.layer - b.layer)
  spotCache[wheel] = out
  return out
}

export function anchorFor(wheel: WheelType, id: string): [number, number] {
  const spot = spotsFor(wheel).find((s) => s.id === id)
  if (spot) return spot.anchor
  const def = betById(wheel, id)
  return def ? centre(pocketRect(def.numbers[0], wheel)) : [NUM_X0, GRID.top]
}

// ---------------------------------------------------------------------------
// The wheel
// ---------------------------------------------------------------------------

/** A point at `angle` degrees clockwise from twelve o'clock, `r` from the wheel's centre. */
export function onWheel(angle: number, r: number): [number, number] {
  const a = (angle * Math.PI) / 180
  return [WHEEL.cx + r * Math.sin(a), WHEEL.cy - r * Math.cos(a)]
}
