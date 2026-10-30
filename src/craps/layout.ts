import type { BetKind } from '../engine/craps/types'

/**
 * The Aria craps layout, in plane pixels.
 *
 * The table is drawn flat on a 2000×900 plane — the whole tub, both ends — and
 * tilted away from the viewer. The player stands at the near-left: their end of
 * the layout fills the left of the frame, the stickman's prop box sits in the
 * middle, and the far end runs off to the right, where the dice come to rest.
 *
 * This module is the single source of truth for where every bet lives. The felt
 * draws its boxes from `SPOTS`, the click targets are those same shapes, and
 * chips stack at anchors derived from them — so a box can never be printed in
 * one place and be clickable in another.
 */

export const STAGE = { w: 1600, h: 900 } as const
export const PLANE = { w: 2000, h: 900 } as const

export const CAMERA = {
  tilt: 26,
  perspective: 1800,
  /** Plane centre, in stage pixels. */
  cx: 877,
  cy: 468,
  z: -330,
} as const

/** The playing surface inside the rail and the pyramid wall. */
export const FELT = { x0: 94, y0: 94, x1: 1906, y1: 828, r: 150 } as const
/** Width of the rubber-lined wall visible inside the rail. */
export const WALL = 28
export const RAIL = 66

export type Shape =
  | { type: 'rect'; x0: number; y0: number; x1: number; y1: number; r?: number }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'path'; d: string; bounds: { x0: number; y0: number; x1: number; y1: number } }

export type SpotTone = 'line' | 'box' | 'number' | 'prop' | 'seven' | 'side'

export interface Spot {
  id: string
  kind: BetKind
  number?: number
  shape: Shape
  tone: SpotTone
  /** Takes a place, buy or lay bet — or odds — depending on the chosen mode. */
  numberBox?: boolean
}

// ---------------------------------------------------------------------------
// The player's end
// ---------------------------------------------------------------------------

const L = {
  /** Pass line: an L round the near side and up the end. */
  passOuter: 112,
  passInner: 186,
  passTop: 178,
  passY0: 742,
  passY1: 814,
  right: 806,
  inner: 198,
  dpY0: 690,
  dpY1: 734,
  fieldY0: 548,
  fieldY1: 682,
  comeY0: 406,
  comeY1: 540,
  numY0: 134,
  numY1: 398,
  dcX1: 294,
  numX0: 302,
} as const

const PASS_PATH = [
  `M ${L.passOuter} ${L.passTop + 12}`,
  `Q ${L.passOuter} ${L.passTop} ${L.passOuter + 12} ${L.passTop}`,
  `L ${L.passInner - 12} ${L.passTop}`,
  `Q ${L.passInner} ${L.passTop} ${L.passInner} ${L.passTop + 12}`,
  `L ${L.passInner} ${L.passY0}`,
  `L ${L.right - 12} ${L.passY0}`,
  `Q ${L.right} ${L.passY0} ${L.right} ${L.passY0 + 12}`,
  `L ${L.right} ${L.passY1 - 12}`,
  `Q ${L.right} ${L.passY1} ${L.right - 12} ${L.passY1}`,
  // The outer corner follows the curve of the tub rather than poking through it.
  `L ${L.passOuter + 130} ${L.passY1}`,
  `A 130 130 0 0 1 ${L.passOuter} ${L.passY1 - 130}`,
  'Z',
].join(' ')

export const BOX_NUMBERS = [4, 5, 6, 8, 9, 10] as const
const NUM_GAP = 6
const NUM_W = (L.right - L.numX0 - NUM_GAP * 5) / 6

export function numberBox(n: number): { x0: number; x1: number; y0: number; y1: number } {
  const i = BOX_NUMBERS.indexOf(n as (typeof BOX_NUMBERS)[number])
  const x0 = L.numX0 + i * (NUM_W + NUM_GAP)
  return { x0, x1: x0 + NUM_W, y0: L.numY0, y1: L.numY1 }
}

// ---------------------------------------------------------------------------
// The stickman's prop box
// ---------------------------------------------------------------------------

export const CENTRE = { x0: 826, x1: 1174 } as const
const CX_MID = (CENTRE.x0 + CENTRE.x1) / 2
const HALF_L = { x0: CENTRE.x0, x1: CX_MID - 2 }
const HALF_R = { x0: CX_MID + 2, x1: CENTRE.x1 }

export const SIDE_Y = 758
export const SIDE_R = 38
const SIDE_X = [870, 957, 1044, 1131]

const rect = (x0: number, y0: number, x1: number, y1: number, r = 8): Shape => ({ type: 'rect', x0, y0, x1, y1, r })

export const SPOTS: Spot[] = [
  // --- The line ------------------------------------------------------------
  {
    id: 'passLine',
    kind: 'passLine',
    tone: 'line',
    shape: { type: 'path', d: PASS_PATH, bounds: { x0: L.passOuter, y0: L.passTop, x1: L.right, y1: L.passY1 } },
  },
  { id: 'dontPass', kind: 'dontPass', tone: 'line', shape: rect(L.inner, L.dpY0, L.right, L.dpY1) },
  { id: 'field', kind: 'field', tone: 'box', shape: rect(L.inner, L.fieldY0, L.right, L.fieldY1) },
  { id: 'come', kind: 'come', tone: 'box', shape: rect(L.inner, L.comeY0, L.right, L.comeY1) },
  { id: 'dontCome', kind: 'dontCome', tone: 'box', shape: rect(L.inner, L.numY0, L.dcX1, L.numY1) },
  ...BOX_NUMBERS.map<Spot>((n) => {
    const b = numberBox(n)
    return { id: `number-${n}`, kind: 'place', number: n, tone: 'number', numberBox: true, shape: rect(b.x0, b.y0, b.x1, b.y1) }
  }),

  // --- Centre ----------------------------------------------------------------
  { id: 'any7', kind: 'any7', tone: 'seven', shape: rect(CENTRE.x0, 134, CENTRE.x1, 190) },
  { id: 'hard-6', kind: 'hard', number: 6, tone: 'prop', shape: rect(HALF_L.x0, 198, HALF_L.x1, 296) },
  { id: 'hard-10', kind: 'hard', number: 10, tone: 'prop', shape: rect(HALF_R.x0, 198, HALF_R.x1, 296) },
  { id: 'hard-8', kind: 'hard', number: 8, tone: 'prop', shape: rect(HALF_L.x0, 300, HALF_L.x1, 398) },
  { id: 'hard-4', kind: 'hard', number: 4, tone: 'prop', shape: rect(HALF_R.x0, 300, HALF_R.x1, 398) },
  { id: 'two', kind: 'two', tone: 'prop', shape: rect(HALF_L.x0, 406, HALF_L.x1, 484) },
  { id: 'twelve', kind: 'twelve', tone: 'prop', shape: rect(HALF_R.x0, 406, HALF_R.x1, 484) },
  { id: 'three', kind: 'three', tone: 'prop', shape: rect(HALF_L.x0, 488, HALF_L.x1, 566) },
  { id: 'eleven', kind: 'eleven', tone: 'prop', shape: rect(HALF_R.x0, 488, HALF_R.x1, 566) },
  { id: 'horn', kind: 'horn', tone: 'prop', shape: rect(HALF_L.x0, 574, HALF_L.x1, 622) },
  { id: 'world', kind: 'world', tone: 'prop', shape: rect(HALF_R.x0, 574, HALF_R.x1, 622) },
  { id: 'ce', kind: 'ce', tone: 'seven', shape: rect(CENTRE.x0, 630, CENTRE.x0 + 84, 690) },
  { id: 'anyCraps', kind: 'anyCraps', tone: 'seven', shape: rect(CENTRE.x0 + 90, 630, CENTRE.x1, 690) },

  // --- Side bets -----------------------------------------------------------------
  { id: 'fire', kind: 'fire', tone: 'side', shape: { type: 'circle', cx: SIDE_X[0], cy: SIDE_Y, r: SIDE_R } },
  { id: 'small', kind: 'small', tone: 'side', shape: { type: 'circle', cx: SIDE_X[1], cy: SIDE_Y, r: SIDE_R } },
  { id: 'tall', kind: 'tall', tone: 'side', shape: { type: 'circle', cx: SIDE_X[2], cy: SIDE_Y, r: SIDE_R } },
  { id: 'all', kind: 'all', tone: 'side', shape: { type: 'circle', cx: SIDE_X[3], cy: SIDE_Y, r: SIDE_R } },
]

export const SPOT_BY_ID = new Map(SPOTS.map((s) => [s.id, s]))

export function centreOf(shape: Shape): [number, number] {
  if (shape.type === 'circle') return [shape.cx, shape.cy]
  const b = shape.type === 'rect' ? shape : shape.bounds
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]
}

export function rectPath(x0: number, y0: number, x1: number, y1: number, r = 8): string {
  return [
    `M ${x0 + r} ${y0}`,
    `L ${x1 - r} ${y0}`,
    `Q ${x1} ${y0} ${x1} ${y0 + r}`,
    `L ${x1} ${y1 - r}`,
    `Q ${x1} ${y1} ${x1 - r} ${y1}`,
    `L ${x0 + r} ${y1}`,
    `Q ${x0} ${y1} ${x0} ${y1 - r}`,
    `L ${x0} ${y0 + r}`,
    `Q ${x0} ${y0} ${x0 + r} ${y0}`,
    'Z',
  ].join(' ')
}

export function shapePath(shape: Shape): string {
  if (shape.type === 'path') return shape.d
  if (shape.type === 'circle') {
    const { cx, cy, r } = shape
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`
  }
  return rectPath(shape.x0, shape.y0, shape.x1, shape.y1, shape.r ?? 8)
}

/** The far end: the player's end mirrored about the table's centre line. */
export function mirrorX(x: number): number {
  return PLANE.w - x
}

export const LAYOUT = L

// ---------------------------------------------------------------------------
// Where chips sit
// ---------------------------------------------------------------------------

/** The player stands here, so line bets go down in front of this spot. */
export const PLAYER_X = 252

/**
 * Where a given bet's chips sit.
 *
 * A box number carries up to three separate wagers — a place (or buy, or lay)
 * bet in the middle, a come bet that travelled there at the near edge, and a
 * don't come bet behind the number at the far edge — which is exactly how a
 * dealer keeps them apart on a real layout. Odds sit just beside the bet they
 * back.
 */
export function anchorFor(kind: BetKind, number?: number): [number, number] {
  if (number !== undefined && (kind === 'place' || kind === 'buy' || kind === 'lay' || kind === 'comePoint' || kind === 'comeOdds' || kind === 'dontComePoint' || kind === 'dontComeOdds')) {
    const b = numberBox(number)
    const x = (b.x0 + b.x1) / 2
    switch (kind) {
      case 'comePoint':
        return [x - 10, b.y1 - 40]
      case 'comeOdds':
        return [x + 16, b.y1 - 28]
      case 'dontComePoint':
        return [x - 10, b.y0 + 48]
      case 'dontComeOdds':
        return [x + 16, b.y0 + 60]
      default:
        return [x, (b.y0 + b.y1) / 2 + 20]
    }
  }
  switch (kind) {
    // Line and come bets sit at the left of their strips, clear of the
    // printing, with odds just behind and to the right of the bet they back.
    case 'passLine':
      return [PLAYER_X, (L.passY0 + L.passY1) / 2 - 4]
    case 'passOdds':
      return [PLAYER_X + 58, (L.passY0 + L.passY1) / 2 + 6]
    case 'dontPass':
      return [PLAYER_X, (L.dpY0 + L.dpY1) / 2]
    case 'dontPassOdds':
      return [PLAYER_X + 58, (L.dpY0 + L.dpY1) / 2]
    case 'come':
      return [PLAYER_X, (L.comeY0 + L.comeY1) / 2 + 18]
    case 'dontCome':
      return [(L.inner + L.dcX1) / 2, L.numY1 - 50]
    case 'field':
      return [PLAYER_X + 90, L.fieldY1 - 22]
    default: {
      const spot = SPOTS.find((s) => s.kind === kind && (number === undefined || s.number === number))
      return spot ? centreOf(spot.shape) : [CX_MID, 400]
    }
  }
}

// ---------------------------------------------------------------------------
// The puck, and the dice
// ---------------------------------------------------------------------------

/** OFF sits in the Don't Come box; ON sits at the top of the point's box. */
export function puckPosition(point: number | null): [number, number] {
  if (point === null) return [(L.inner + L.dcX1) / 2, L.numY0 + 46]
  const b = numberBox(point)
  return [(b.x0 + b.x1) / 2, b.y0 + 30]
}

export const DICE = {
  /** Plane pixels per simulation unit; a die is one unit. */
  scale: 34,
  /** Where the shooter's hand releases them. */
  release: { x: 600, y: 790, h: 70 },
  /** The stretch of back wall a throw is aimed at. */
  aim: { x0: 1240, x1: 1430 },
  /** Where a good throw finishes: the far end, clear of the prop box and the rail. */
  zone: { x0: 1195, x1: 1470, y0: 130, y1: 600 },
  /** Walls the dice bounce off — the inside faces of the tub. */
  walls: { x0: FELT.x0, x1: FELT.x1, y0: FELT.y0, y1: FELT.y1 },
  /**
   * When the bet rail or a drawer covers the far end, the throw is sent nearer
   * the shooter instead, so it is still seen whole: aimed at back wall that
   * many plane pixels to the left, and finishing in a zone moved the same way.
   * The first lane is the far end itself.
   */
  lanes: [0, 125, 250, 375, 500, 625, 750, 875, 1000],
} as const
