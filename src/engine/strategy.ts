import { rankValue } from './cards'
import { evaluate } from './hand'
import type { Card, PlayerAction, PlayerHand, Rank, RuleSet } from './types'

/**
 * Basic strategy for a four- to eight-deck shoe with double after split, in
 * both of the forms a Strip casino deals: dealer stands on soft 17 (Aria's
 * high-limit shoe, and the tables below), or hits it (Aria's main floor), which
 * changes six squares. Double- and single-deck games start from the same card
 * and change the squares listed further down. This is the mathematically
 * optimal play and what the coach overlay grades against.
 *
 * Cell codes:
 *   H   hit
 *   S   stand
 *   D   double if allowed, otherwise hit
 *   Ds  double if allowed, otherwise stand
 *   P   split
 *   Pd  split if double-after-split is allowed, otherwise hit
 *   Rh  surrender if allowed, otherwise hit
 *   Rs  surrender if allowed, otherwise stand
 *   Rp  surrender if allowed, otherwise split
 */
export type Cell = 'H' | 'S' | 'D' | 'Ds' | 'P' | 'Pd' | 'Rh' | 'Rs' | 'Rp'

/** Columns run 2,3,4,5,6,7,8,9,10,A. */
const COLUMNS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const

/** Dealer upcard labels, in chart column order. */
export const CHART_COLUMNS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'] as const

function column(upcardRank: Rank): number {
  const value = rankValue(upcardRank)
  return COLUMNS.indexOf(value as (typeof COLUMNS)[number])
}

/** Hard totals 5..21, indexed by total. */
const HARD: Record<number, Cell[]> = {
  //     2     3     4     5     6     7     8     9    10     A
  5:  ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  6:  ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  7:  ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  8:  ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  9:  ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  10: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
  11: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H'],
  12: ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  13: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  14: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  15: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'H'],
  16: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'Rh', 'Rh', 'Rh'],
  17: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  18: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  19: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  20: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  21: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
}

/** Soft totals, indexed by the non-ace total (A,2 = 2 ... A,9 = 9). */
const SOFT: Record<number, Cell[]> = {
  //    2     3     4     5     6     7     8     9    10     A
  2: ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  3: ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  4: ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  5: ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  6: ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  // Soft 18 stands against a 2 under S17 — doubling only gains from 3 up.
  7: ['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
  8: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  9: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
}

/** Pairs, indexed by the value of one card (11 = aces). */
const PAIRS: Record<number, Cell[]> = {
  //     2     3     4     5     6     7     8     9    10     A
  2:  ['Pd', 'Pd', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  3:  ['Pd', 'Pd', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  4:  ['H', 'H', 'H', 'Pd', 'Pd', 'H', 'H', 'H', 'H', 'H'],
  5:  ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
  6:  ['Pd', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H', 'H'],
  7:  ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  8:  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  9:  ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S'],
  10: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  11: ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
}

export interface StrategyContext {
  rules: RuleSet
  /** Actions the engine will actually accept right now. */
  legal: readonly PlayerAction[]
}

export type ChartSectionId = 'hard' | 'soft' | 'pairs'

/**
 * Where a hand lands on the printed chart, and what that square says.
 *
 * Returning the coordinates alongside the cell is what lets the on-screen
 * strategy card highlight the player's exact square rather than re-deriving the
 * lookup and risking the two disagreeing.
 */
export interface ChartPosition {
  section: ChartSectionId
  /** Hard total, non-ace value of a soft hand, or the value of one paired card. */
  key: number
  column: number
  cell: Cell
}

interface Tables {
  hard: Record<number, Cell[]>
  soft: Record<number, Cell[]>
  pairs: Record<number, Cell[]>
}

const S17_TABLES: Tables = { hard: HARD, soft: SOFT, pairs: PAIRS }

interface Change {
  table: keyof Tables
  key: number
  column: number
  cell: Cell
}

/**
 * The squares that change when the dealer hits soft 17.
 *
 * A dealer who draws to soft 17 busts a little more and makes a little more,
 * which tips six close decisions — all of them against a 2, a 6 or an ace,
 * the upcards whose outcomes a soft 17 most affects.
 */
const H17_CHANGES: Change[] = [
  { table: 'hard', key: 11, column: 9, cell: 'D' }, //   11 v A: double
  { table: 'hard', key: 15, column: 9, cell: 'Rh' }, //  15 v A: surrender, else hit
  { table: 'hard', key: 17, column: 9, cell: 'Rs' }, //  17 v A: surrender, else stand
  { table: 'soft', key: 7, column: 0, cell: 'Ds' }, //  A,7 v 2: double, else stand
  { table: 'soft', key: 8, column: 4, cell: 'Ds' }, //  A,8 v 6: double, else stand
  { table: 'pairs', key: 8, column: 9, cell: 'Rp' }, // 8,8 v A: surrender, else split
]

function withChanges(base: Tables, changes: readonly Change[]): Tables {
  const copy = (t: Record<number, Cell[]>) =>
    Object.fromEntries(Object.entries(t).map(([k, cells]) => [k, cells.slice()])) as Record<number, Cell[]>
  const tables: Tables = { hard: copy(base.hard), soft: copy(base.soft), pairs: copy(base.pairs) }
  for (const change of changes) tables[change.table][change.key][change.column] = change.cell
  return tables
}

const H17_TABLES: Tables = withChanges(S17_TABLES, H17_CHANGES)

/**
 * The squares that change with fewer decks. Every card dealt shifts a small
 * shoe noticeably, so a two-deck game doubles and splits a little more and
 * surrenders a little less, and a single deck more so again.
 *
 * These come from an exact analysis of each game (late surrender, double on
 * any two cards, with and without double after split), keeping only the
 * squares where the better play is worth at least a tenth of a percent.
 */
const DOUBLE_DECK_CHANGES: Change[] = [
  { table: 'hard', key: 9, column: 0, cell: 'D' }, //   9 v 2: double
  { table: 'hard', key: 16, column: 7, cell: 'H' }, //  16 v 9: hit, don't surrender
  { table: 'pairs', key: 6, column: 0, cell: 'P' }, //  6,6 v 2: split even without DAS
  { table: 'pairs', key: 6, column: 5, cell: 'Pd' }, // 6,6 v 7: split with DAS
  { table: 'pairs', key: 7, column: 6, cell: 'Pd' }, // 7,7 v 8: split with DAS
]

const DOUBLE_DECK_S17: Change[] = [
  ...DOUBLE_DECK_CHANGES,
  { table: 'hard', key: 11, column: 9, cell: 'D' }, //  11 v A: double
]

const DOUBLE_DECK_H17: Change[] = [
  ...DOUBLE_DECK_CHANGES,
  { table: 'pairs', key: 8, column: 9, cell: 'Pd' }, // 8,8 v A: split with DAS, else surrender
]

const SINGLE_DECK_CHANGES: Change[] = [
  { table: 'hard', key: 8, column: 3, cell: 'D' }, //   8 v 5: double
  { table: 'hard', key: 8, column: 4, cell: 'D' }, //   8 v 6: double
  { table: 'hard', key: 9, column: 0, cell: 'D' }, //   9 v 2: double
  { table: 'hard', key: 15, column: 8, cell: 'H' }, //  15 v 10: hit, don't surrender
  { table: 'hard', key: 16, column: 7, cell: 'H' }, //  16 v 9: hit, don't surrender
  { table: 'soft', key: 2, column: 2, cell: 'D' }, //   A,2 v 4: double
  { table: 'soft', key: 3, column: 2, cell: 'D' }, //   A,3 v 4: double
  { table: 'soft', key: 6, column: 0, cell: 'D' }, //   A,6 v 2: double
  { table: 'pairs', key: 2, column: 1, cell: 'P' }, //  2,2 v 3: split even without DAS
  { table: 'pairs', key: 3, column: 6, cell: 'Pd' }, // 3,3 v 8: split with DAS
  { table: 'pairs', key: 4, column: 2, cell: 'Pd' }, // 4,4 v 4: split with DAS
  { table: 'pairs', key: 6, column: 0, cell: 'P' }, //  6,6 v 2: split even without DAS
  { table: 'pairs', key: 6, column: 5, cell: 'Pd' }, // 6,6 v 7: split with DAS
  { table: 'pairs', key: 7, column: 6, cell: 'Pd' }, // 7,7 v 8: split with DAS
  { table: 'pairs', key: 7, column: 8, cell: 'Rs' }, // 7,7 v 10: surrender, else stand
]

const SINGLE_DECK_S17: Change[] = [
  ...SINGLE_DECK_CHANGES,
  { table: 'hard', key: 11, column: 9, cell: 'D' }, //  11 v A: double
  { table: 'soft', key: 7, column: 9, cell: 'S' }, //   A,7 v A: stand
]

const SINGLE_DECK_H17: Change[] = [
  ...SINGLE_DECK_CHANGES,
  { table: 'soft', key: 7, column: 0, cell: 'S' }, //   A,7 v 2: stand
  { table: 'pairs', key: 7, column: 9, cell: 'Rh' }, // 7,7 v A: surrender, else hit
  { table: 'pairs', key: 8, column: 9, cell: 'P' }, //  8,8 v A: split
]

const TABLES = {
  shoe: { s17: S17_TABLES, h17: H17_TABLES },
  double: { s17: withChanges(S17_TABLES, DOUBLE_DECK_S17), h17: withChanges(H17_TABLES, DOUBLE_DECK_H17) },
  single: { s17: withChanges(S17_TABLES, SINGLE_DECK_S17), h17: withChanges(H17_TABLES, SINGLE_DECK_H17) },
}

type ChartRules = Pick<RuleSet, 'dealerHitsSoft17' | 'decks'>

function tablesFor(rules: ChartRules): Tables {
  const game = rules.decks === 1 ? TABLES.single : rules.decks === 2 ? TABLES.double : TABLES.shoe
  return rules.dealerHitsSoft17 ? game.h17 : game.s17
}


export function chartPosition(hand: PlayerHand, upcard: Card, rules: RuleSet): ChartPosition {
  const col = column(upcard.rank)
  const value = evaluate(hand.cards)
  const t = tablesFor(rules)

  const isPair =
    hand.cards.length === 2 && rankValue(hand.cards[0].rank) === rankValue(hand.cards[1].rank)
  if (isPair) {
    const pairValue = rankValue(hand.cards[0].rank)
    // Split aces are frozen after their one card, so never recommend a resplit
    // the rules would refuse.
    if (pairValue !== 11 || rules.maxSplitHands > 1) {
      return { section: 'pairs', key: pairValue, column: col, cell: t.pairs[pairValue][col] }
    }
  }

  if (value.soft) {
    const nonAce = value.total - 11
    if (nonAce >= 2 && nonAce <= 9) {
      return { section: 'soft', key: nonAce, column: col, cell: t.soft[nonAce][col] }
    }
    // Soft 12 (A,A when splitting is unavailable) always hits.
    if (nonAce <= 1) return { section: 'pairs', key: 11, column: col, cell: 'H' }
  }

  const total = Math.min(21, Math.max(5, value.total))
  return { section: 'hard', key: total, column: col, cell: t.hard[total][col] }
}

/** Which cell of the chart applies to this hand. */
function lookup(hand: PlayerHand, upcard: Card, rules: RuleSet): Cell {
  return chartPosition(hand, upcard, rules).cell
}

/**
 * The correct play, already reduced against what the engine permits — so the
 * coach never tells the player to double on a three-card hand.
 */
export function basicStrategy(
  hand: PlayerHand,
  upcard: Card,
  ctx: StrategyContext,
): PlayerAction {
  const cell = lookup(hand, upcard, ctx.rules)
  const can = (a: PlayerAction) => ctx.legal.includes(a)

  switch (cell) {
    case 'S':
      return 'stand'
    case 'H':
      return 'hit'
    case 'D':
      return can('double') ? 'double' : 'hit'
    case 'Ds':
      return can('double') ? 'double' : 'stand'
    case 'P':
      return can('split') ? 'split' : fallbackForPair(hand, upcard, ctx)
    case 'Pd':
      // Charted as a split only when double-after-split is on; without DAS the
      // pair is worth more played as a single total.
      if (can('split') && ctx.rules.doubleAfterSplit) return 'split'
      return fallbackForPair(hand, upcard, ctx)
    case 'Rh':
      return can('surrender') ? 'surrender' : 'hit'
    case 'Rs':
      return can('surrender') ? 'surrender' : 'stand'
    case 'Rp':
      if (can('surrender')) return 'surrender'
      return can('split') ? 'split' : fallbackForPair(hand, upcard, ctx)
  }
}

/**
 * When a split is charted but unavailable (max hands reached, or DAS off),
 * fall back to playing the total.
 */
function fallbackForPair(hand: PlayerHand, upcard: Card, ctx: StrategyContext): PlayerAction {
  const col = column(upcard.rank)
  const value = evaluate(hand.cards)
  // A pair of twos totals 4, below the chart's floor — clamp into range.
  const total = Math.min(21, Math.max(5, value.total))
  const cell = value.soft && value.total === 12 ? 'H' : tablesFor(ctx.rules).hard[total][col]
  switch (cell) {
    case 'S':
      return 'stand'
    case 'D':
      return ctx.legal.includes('double') ? 'double' : 'hit'
    case 'Ds':
      return ctx.legal.includes('double') ? 'double' : 'stand'
    case 'Rh':
      return ctx.legal.includes('surrender') ? 'surrender' : 'hit'
    case 'Rs':
      return ctx.legal.includes('surrender') ? 'surrender' : 'stand'
    default:
      return 'hit'
  }
}

/**
 * Insurance is a losing bet at a neutral count regardless of the player's hand
 * — even with a natural. Only a true count of +3 or better makes it positive,
 * and only a player who is keeping the count can know that, so without it the
 * answer is always no.
 */
export function shouldTakeInsurance(trueCount: number, counting = true): boolean {
  return counting && trueCount >= 3
}

// ---------------------------------------------------------------------------
// Printable chart
// ---------------------------------------------------------------------------

export interface ChartRow {
  label: string
  cells: readonly Cell[]
  /**
   * Which `ChartPosition.key` values this row stands for. Rows that are
   * identical across every dealer upcard are collapsed the way a real strategy
   * card collapses them, so one row can cover several totals.
   */
  keys: readonly number[]
  /**
   * The lookup table this row came from. Hard and soft totals share one printed
   * block, so the row has to carry its own origin for highlight matching.
   */
  section: ChartSectionId
}

export interface ChartSection {
  id: string
  title: string
  /** What the left-hand column of this block means. */
  caption: string
  rows: readonly ChartRow[]
}

/**
 * The lookup tables for a rule set, arranged for display.
 *
 * Hard and soft totals print as one continuous block — they are both just "your
 * total", and splitting them adds a heading and a gap for no gain. Pairs stay
 * separate because they are a genuinely different decision. Rows that read
 * identically all the way across are merged, as a printed card does: hard 5
 * through 8 always hit (except in single deck, where 8 doubles against a 5 or
 * 6 and gets its own row), and hard 17 and up always stand — unless the dealer
 * hits soft 17, when 17 against an ace becomes a surrender and gets its own
 * row.
 */
export function strategyChart(rules: ChartRules): readonly ChartSection[] {
  const t = tablesFor(rules)
  const same = (a: readonly Cell[], b: readonly Cell[]) => a.every((cell, i) => cell === b[i])
  const high = [17, 18, 19, 20, 21]
  const low = [5, 6, 7, 8]
  const bottom: ChartRow[] = low.every((k) => same(t.hard[k], t.hard[5]))
    ? [{ label: '5–8', cells: t.hard[5], keys: low, section: 'hard' }]
    : [
        { label: '5–7', cells: t.hard[5], keys: [5, 6, 7], section: 'hard' },
        { label: '8', cells: t.hard[8], keys: [8], section: 'hard' },
      ]
  const top: ChartRow[] = high.every((k) => same(t.hard[k], t.hard[17]))
    ? [{ label: '17+', cells: t.hard[17], keys: high, section: 'hard' }]
    : [
        { label: '17', cells: t.hard[17], keys: [17], section: 'hard' },
        { label: '18+', cells: t.hard[18], keys: [18, 19, 20, 21], section: 'hard' },
      ]

  return [
    {
      id: 'totals',
      title: 'Totals',
      caption: 'Your hand',
      rows: [
        ...bottom,
        ...[9, 10, 11, 12, 13, 14, 15, 16].map<ChartRow>((k) => ({ label: String(k), cells: t.hard[k], keys: [k], section: 'hard' })),
        ...top,
        ...[2, 3, 4, 5, 6, 7, 8, 9].map<ChartRow>((k) => ({ label: `A,${k}`, cells: t.soft[k], keys: [k], section: 'soft' })),
      ],
    },
    {
      id: 'pairs',
      title: 'Pairs',
      caption: 'Your pair',
      rows: [
        { label: 'A,A', cells: t.pairs[11], keys: [11], section: 'pairs' },
        ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map<ChartRow>((k) => ({ label: `${k},${k}`, cells: t.pairs[k], keys: [k], section: 'pairs' })),
      ],
    },
  ]
}

/** The card for the stand-on-soft-17 game — Aria's high-limit shoe. */
export const STRATEGY_CHART: readonly ChartSection[] = strategyChart({ dealerHitsSoft17: false, decks: 6 })

/**
 * Whether the card is exact for these rules. It is computed for one, two, and
 * four to eight decks with doubling on any two cards, with or without double
 * after split (the Pd squares), either way on soft 17. The classic single-deck
 * game, which only doubles 10 and 11, was checked separately: following the
 * card there gives up nothing either.
 */
export function chartIsExact(rules: RuleSet): boolean {
  if (rules.decks === 3) return false
  if (rules.doubleOn === 'any') return true
  return rules.decks === 1 && !rules.dealerHitsSoft17 && rules.doubleOn === '10-11'
}

export const CELL_LABELS: Record<Cell, string> = {
  H: 'H',
  S: 'S',
  D: 'D',
  Ds: 'Ds',
  P: 'P',
  Pd: 'P*',
  Rh: 'R',
  Rs: 'Rs',
  Rp: 'Rp',
}

export const CELL_LEGEND: Array<{ cell: Cell; name: string; note: string }> = [
  { cell: 'S', name: 'Stand', note: 'Take no more cards' },
  { cell: 'H', name: 'Hit', note: 'Draw another card' },
  { cell: 'D', name: 'Double', note: 'Double if allowed, otherwise hit' },
  { cell: 'Ds', name: 'Double / stand', note: 'Double if allowed, otherwise stand' },
  { cell: 'P', name: 'Split', note: 'Always split this pair' },
  { cell: 'Pd', name: 'Split with DAS', note: 'Split only if doubling after a split is allowed' },
  { cell: 'Rh', name: 'Surrender', note: 'Surrender if offered, otherwise hit' },
  { cell: 'Rs', name: 'Surrender / stand', note: 'Surrender if offered, otherwise stand' },
  { cell: 'Rp', name: 'Surrender / split', note: 'Surrender if offered, otherwise split' },
]

export const ACTION_LABELS: Record<PlayerAction, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
  insurance: 'Take insurance',
  declineInsurance: 'Decline insurance',
}
