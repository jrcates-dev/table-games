import { DOUBLE_ZERO, pocketCount, pocketLabel, RED_NUMBERS, type Pocket, type WheelType } from './wheel'

/**
 * Every bet the layout takes, defined by nothing more than the pockets it
 * covers and what it pays. The house edge falls straight out of those two
 * numbers, which is why every bet on a double-zero wheel costs exactly the
 * same 5.26% — except the one five-number bet that cannot be paid fairly at
 * whole odds, and so costs more.
 */

export type RouletteBetKind =
  | 'straight'
  | 'split'
  | 'street'
  | 'trio'
  | 'corner'
  | 'basket'
  | 'sixLine'
  | 'column'
  | 'dozen'
  | 'red'
  | 'black'
  | 'odd'
  | 'even'
  | 'low'
  | 'high'

export interface BetDef {
  id: string
  kind: RouletteBetKind
  /** Pockets this bet wins on, ascending, with 00 as 37. */
  numbers: Pocket[]
}

const INSIDE: ReadonlySet<RouletteBetKind> = new Set(['straight', 'split', 'street', 'trio', 'corner', 'basket', 'sixLine'])

export function isInside(kind: RouletteBetKind): boolean {
  return INSIDE.has(kind)
}

/** What a winning bet pays, to one. */
export function payFor(def: Pick<BetDef, 'kind' | 'numbers'>): number {
  switch (def.kind) {
    case 'straight':
      return 35
    case 'split':
      return 17
    case 'street':
    case 'trio':
      return 11
    case 'corner':
      return 8
    case 'basket':
      // The first four on a single-zero wheel is a corner in all but name;
      // the five-number top line on a double-zero wheel pays 6 because 6.2
      // cannot be paid.
      return def.numbers.length === 4 ? 8 : 6
    case 'sixLine':
      return 5
    case 'column':
    case 'dozen':
      return 2
    default:
      return 1
  }
}

/** The house's expected win per dollar of this bet. */
export function houseEdge(def: Pick<BetDef, 'kind' | 'numbers'>, wheel: WheelType): number {
  const n = pocketCount(wheel)
  return 1 - (def.numbers.length * (payFor(def) + 1)) / n
}

export function winProbability(def: Pick<BetDef, 'numbers'>, wheel: WheelType): number {
  return def.numbers.length / pocketCount(wheel)
}

function inside(kind: RouletteBetKind, numbers: Pocket[]): BetDef {
  const sorted = numbers.slice().sort((a, b) => a - b)
  return { id: `${kind}:${sorted.join('-')}`, kind, numbers: sorted }
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

export function columnNumbers(column: 1 | 2 | 3): number[] {
  return range(1, 36).filter((n) => (n - 1) % 3 === column - 1)
}

export function dozenNumbers(dozen: 1 | 2 | 3): number[] {
  return range(dozen * 12 - 11, dozen * 12)
}

export function outside(kind: Exclude<RouletteBetKind, 'straight' | 'split' | 'street' | 'trio' | 'corner' | 'basket' | 'sixLine'>, which?: 1 | 2 | 3): BetDef {
  const all = range(1, 36)
  switch (kind) {
    case 'column':
      return { id: `column:${which}`, kind, numbers: columnNumbers(which ?? 1) }
    case 'dozen':
      return { id: `dozen:${which}`, kind, numbers: dozenNumbers(which ?? 1) }
    case 'red':
      return { id: 'red', kind, numbers: all.filter((n) => RED_NUMBERS.has(n)) }
    case 'black':
      return { id: 'black', kind, numbers: all.filter((n) => !RED_NUMBERS.has(n)) }
    case 'odd':
      return { id: 'odd', kind, numbers: all.filter((n) => n % 2 === 1) }
    case 'even':
      return { id: 'even', kind, numbers: all.filter((n) => n % 2 === 0) }
    case 'low':
      return { id: 'low', kind, numbers: range(1, 18) }
    case 'high':
      return { id: 'high', kind, numbers: range(19, 36) }
  }
}

/**
 * Every legal bet on a layout. The zeros sit at the end of the board: on a
 * double-zero layout the 0 beside the 1 and 2, the 00 beside the 2 and 3.
 */
export function allBets(wheel: WheelType): BetDef[] {
  const out: BetDef[] = []
  const zeros: Pocket[] = wheel === 'double' ? [0, DOUBLE_ZERO] : [0]
  for (const z of zeros) out.push(inside('straight', [z]))
  for (const n of range(1, 36)) out.push(inside('straight', [n]))

  // Splits: along a row, and up a column.
  for (const n of range(1, 33)) out.push(inside('split', [n, n + 3]))
  for (const n of range(1, 35)) if (n % 3 !== 0) out.push(inside('split', [n, n + 1]))

  for (const c of range(1, 12)) out.push(inside('street', [3 * c - 2, 3 * c - 1, 3 * c]))
  for (const n of range(1, 32)) if (n % 3 !== 0) out.push(inside('corner', [n, n + 1, n + 3, n + 4]))
  for (const c of range(1, 11)) out.push(inside('sixLine', range(3 * c - 2, 3 * c + 3)))

  if (wheel === 'double') {
    out.push(inside('split', [0, 1]), inside('split', [0, 2]), inside('split', [2, DOUBLE_ZERO]), inside('split', [3, DOUBLE_ZERO]), inside('split', [0, DOUBLE_ZERO]))
    out.push(inside('trio', [0, 1, 2]), inside('trio', [0, 2, DOUBLE_ZERO]), inside('trio', [2, 3, DOUBLE_ZERO]))
    out.push(inside('basket', [0, DOUBLE_ZERO, 1, 2, 3]))
  } else {
    out.push(inside('split', [0, 1]), inside('split', [0, 2]), inside('split', [0, 3]))
    out.push(inside('trio', [0, 1, 2]), inside('trio', [0, 2, 3]))
    out.push(inside('basket', [0, 1, 2, 3]))
  }

  for (const k of [1, 2, 3] as const) out.push(outside('column', k), outside('dozen', k))
  for (const kind of ['red', 'black', 'odd', 'even', 'low', 'high'] as const) out.push(outside(kind))
  return out
}

const catalogues: Partial<Record<WheelType, Map<string, BetDef>>> = {}

export function betById(wheel: WheelType, id: string): BetDef | undefined {
  catalogues[wheel] ??= new Map(allBets(wheel).map((b) => [b.id, b]))
  return catalogues[wheel]!.get(id)
}

const KIND_NAME: Record<RouletteBetKind, string> = {
  straight: 'Straight up',
  split: 'Split',
  street: 'Street',
  trio: 'Trio',
  corner: 'Corner',
  basket: 'Top Line',
  sixLine: 'Six Line',
  column: 'Column',
  dozen: 'Dozen',
  red: 'Red',
  black: 'Black',
  odd: 'Odd',
  even: 'Even',
  low: '1 to 18',
  high: '19 to 36',
}

export function kindName(kind: RouletteBetKind, numbers?: Pocket[]): string {
  if (kind === 'basket' && numbers?.length === 4) return 'First Four'
  return KIND_NAME[kind]
}

/** "Split 17 / 20" · "Street 16–18" · "2nd Dozen" — what the dealer calls it. */
export function betTitle(def: BetDef): string {
  const nums = def.numbers.map(pocketLabel)
  switch (def.kind) {
    case 'straight':
      return `Straight up ${nums[0]}`
    case 'split':
    case 'corner':
    case 'trio':
      return `${kindName(def.kind)} ${nums.join(' / ')}`
    case 'basket': {
      const order = def.numbers.length === 5 ? ['0', '00', '1', '2', '3'] : ['0', '1', '2', '3']
      return `${kindName(def.kind, def.numbers)} ${order.join('-')}`
    }
    case 'street':
    case 'sixLine':
      return `${kindName(def.kind)} ${nums[0]}–${nums[nums.length - 1]}`
    case 'column':
      return `${ordinal(Number(def.id.split(':')[1]))} Column`
    case 'dozen':
      return `${ordinal(Number(def.id.split(':')[1]))} Dozen`
    default:
      return KIND_NAME[def.kind]
  }
}

function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : '3rd'
}

/** Pay odds as printed: "35 to 1". */
export function payText(def: Pick<BetDef, 'kind' | 'numbers'>): string {
  return `${payFor(def)} to 1`
}
