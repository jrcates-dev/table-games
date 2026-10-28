import type { Rank } from '../types'
import type { Coup } from './types'

/**
 * The tableau: the fixed rules printed on every baccarat layout that decide
 * whether each side takes a third card. Nobody at the table chooses.
 */

/** Ace is one, tens and face cards are nothing, everything else is its pips. */
export function cardPoints(rank: Rank): number {
  if (rank === 'A') return 1
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 0
  return Number(rank)
}

/** A hand's total is the last digit of its points. */
export function handTotal(ranks: readonly Rank[]): number {
  return ranks.reduce((sum, r) => sum + cardPoints(r), 0) % 10
}

export function isNatural(total: number): boolean {
  return total >= 8
}

/** The Player draws on 0–5 and stands on 6 or 7 (8 and 9 are naturals). */
export function playerDraws(total: number): boolean {
  return total <= 5
}

/**
 * Whether the Banker draws, given its two-card total and the Player's third
 * card — or `null` when the Player stood, in which case the Banker plays like
 * the Player: draws on 0–5, stands on 6 and 7.
 */
export function bankerDraws(total: number, playerThird: number | null): boolean {
  if (playerThird === null) return total <= 5
  switch (total) {
    case 0:
    case 1:
    case 2:
      return true
    case 3:
      return playerThird !== 8
    case 4:
      return playerThird >= 2 && playerThird <= 7
    case 5:
      return playerThird >= 4 && playerThird <= 7
    case 6:
      return playerThird === 6 || playerThird === 7
    default:
      return false
  }
}

/** The Banker's row of the tableau as printed: which Player third cards make it draw. */
export function bankerDrawsAgainst(total: number): number[] {
  return Array.from({ length: 10 }, (_, v) => v).filter((v) => bankerDraws(total, v))
}

/** One square of the Banker's chart: the row, the column, and what it says. */
export interface TableauSquare {
  /** The Banker's two-card total. */
  total: number
  /** What the Player's third card counts, or `null` when the Player stood. */
  playerThird: number | null
  draws: boolean
}

/**
 * The square of the Banker's chart a dealt coup was decided on — or `null` on
 * a natural, when nobody drew and the chart never came into it.
 */
export function tableauSquare(coup: Pick<Coup, 'player' | 'banker' | 'natural'>): TableauSquare | null {
  if (coup.natural) return null
  const total = handTotal(coup.banker.slice(0, 2).map((c) => c.rank))
  const third = coup.player[2]
  const playerThird = third ? cardPoints(third.rank) : null
  return { total, playerThird, draws: bankerDraws(total, playerThird) }
}
