import type { Card, Rank } from '../types'
import { BACCARAT_BETS, BANKER_COMMISSION, DRAGON_MARGIN_PAYS, PAIR_PAYS, TIE_PAYS } from './rules'
import type { BaccaratBetKind } from './types'
import { bankerDraws, cardPoints } from './tableau'

/**
 * Exact odds for every bet, from whatever is left in the shoe.
 *
 * A coup only ever uses six cards, and only their point values matter to who
 * wins, so it can be enumerated outright: ten values for each of the four
 * opening cards, then ten for each third card the tableau calls for — at most
 * a million weighted paths, each weighted by drawing those exact values
 * without replacement from the cards actually remaining. That makes it cheap
 * enough to re-run after every coup, which is what lets the rail say what each
 * bet costs *now*, not just off the top of a fresh shoe.
 */

/** How many cards of each point value are left, 0 through 9. */
export type ValueCounts = number[]

export interface CoupOdds {
  player: number
  banker: number
  tie: number
  /** Dragon Bonus distribution, per side. */
  dragon: Record<'player' | 'banker', DragonOdds>
  /** Chance the first two cards to a side are a pair, by rank. */
  pair: number
}

export interface DragonOdds {
  /** Wins with a two-card 8 or 9. */
  naturalWin: number
  /** Both sides natural on the same total. */
  naturalTie: number
  /** Wins after drawing, by margin 1–9. Index is the margin. */
  margin: number[]
}

const RANK_LIST: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function fullShoeRanks(decks: number): Record<Rank, number> {
  return Object.fromEntries(RANK_LIST.map((r) => [r, decks * 4])) as Record<Rank, number>
}

/** Rank counts left after the given cards have been seen. */
export function remainingRanks(decks: number, seen: readonly Pick<Card, 'rank'>[]): Record<Rank, number> {
  const counts = fullShoeRanks(decks)
  for (const card of seen) counts[card.rank] = Math.max(0, counts[card.rank] - 1)
  return counts
}

export function valueCounts(ranks: Record<Rank, number>): ValueCounts {
  const counts = new Array<number>(10).fill(0)
  for (const rank of RANK_LIST) counts[cardPoints(rank)] += ranks[rank]
  return counts
}

export function coupOdds(ranks: Record<Rank, number>): CoupOdds {
  const c = valueCounts(ranks)
  const N = c.reduce((a, b) => a + b, 0)

  let player = 0
  let banker = 0
  let tie = 0
  const dragon = {
    player: { naturalWin: 0, naturalTie: 0, margin: new Array<number>(10).fill(0) },
    banker: { naturalWin: 0, naturalTie: 0, margin: new Array<number>(10).fill(0) },
  }

  const record = (p: number, b: number, natural: boolean, w: number) => {
    if (p > b) {
      player += w
      if (natural) dragon.player.naturalWin += w
      else dragon.player.margin[p - b] += w
    } else if (b > p) {
      banker += w
      if (natural) dragon.banker.naturalWin += w
      else dragon.banker.margin[b - p] += w
    } else {
      tie += w
      if (natural) {
        dragon.player.naturalTie += w
        dragon.banker.naturalTie += w
      }
    }
  }

  // Deal order is Player, Banker, Player, Banker — then the tableau. The order
  // the values are drawn in does not change the probability of a set of
  // values, but enumerating in deal order keeps the weights obviously right.
  let n = N
  for (let p1 = 0; p1 < 10; p1++) {
    if (c[p1] === 0) continue
    const w1 = c[p1] / n
    c[p1]--
    n--
    for (let b1 = 0; b1 < 10; b1++) {
      if (c[b1] === 0) continue
      const w2 = w1 * (c[b1] / n)
      c[b1]--
      n--
      for (let p2 = 0; p2 < 10; p2++) {
        if (c[p2] === 0) continue
        const w3 = w2 * (c[p2] / n)
        c[p2]--
        n--
        for (let b2 = 0; b2 < 10; b2++) {
          if (c[b2] === 0) continue
          const w4 = w3 * (c[b2] / n)
          c[b2]--
          n--

          const p = (p1 + p2) % 10
          const b = (b1 + b2) % 10
          if (p >= 8 || b >= 8) {
            record(p, b, true, w4)
          } else if (p <= 5) {
            // The Player draws; the Banker's move depends on the card it got.
            for (let p3 = 0; p3 < 10; p3++) {
              if (c[p3] === 0) continue
              const w5 = w4 * (c[p3] / n)
              c[p3]--
              n--
              const pf = (p + p3) % 10
              if (bankerDraws(b, p3)) {
                for (let b3 = 0; b3 < 10; b3++) {
                  if (c[b3] === 0) continue
                  record(pf, (b + b3) % 10, false, w5 * (c[b3] / n))
                }
              } else {
                record(pf, b, false, w5)
              }
              c[p3]++
              n++
            }
          } else if (b <= 5) {
            // Player stands on 6 or 7; the Banker draws on 5 or less.
            for (let b3 = 0; b3 < 10; b3++) {
              if (c[b3] === 0) continue
              record(p, (b + b3) % 10, false, w4 * (c[b3] / n))
            }
          } else {
            record(p, b, false, w4)
          }

          c[b2]++
          n++
        }
        c[p2]++
        n++
      }
      c[b1]++
      n++
    }
    c[p1]++
    n++
  }

  // Any two cards from the shoe: the chance they share a rank.
  let same = 0
  for (const rank of RANK_LIST) same += ranks[rank] * (ranks[rank] - 1)
  const pair = N > 1 ? same / (N * (N - 1)) : 0

  return { player, banker, tie, dragon, pair }
}

/** Expected profit per dollar of each bet, from the player's side: negative is the house's edge. */
export function betEvs(odds: CoupOdds): Record<BaccaratBetKind, number> {
  const dragonEv = (d: DragonOdds) => {
    let win = d.naturalWin
    let paid = d.naturalWin
    for (let m = 1; m <= 9; m++) {
      const pays = DRAGON_MARGIN_PAYS[m] ?? 0
      if (pays > 0) {
        win += d.margin[m]
        paid += d.margin[m] * pays
      }
    }
    const lose = 1 - win - d.naturalTie
    return paid - lose
  }
  return {
    player: odds.player - odds.banker,
    banker: odds.banker * (1 - BANKER_COMMISSION) - odds.player,
    tie: odds.tie * TIE_PAYS - (1 - odds.tie),
    playerPair: odds.pair * PAIR_PAYS - (1 - odds.pair),
    bankerPair: odds.pair * PAIR_PAYS - (1 - odds.pair),
    dragonPlayer: dragonEv(odds.dragon.player),
    dragonBanker: dragonEv(odds.dragon.banker),
  }
}

/** House edge on every bet — the EVs with the sign turned round, so positive costs you. */
export function houseEdges(ranks: Record<Rank, number>): Record<BaccaratBetKind, number> {
  const evs = betEvs(coupOdds(ranks))
  return Object.fromEntries(Object.entries(evs).map(([k, ev]) => [k, -ev])) as Record<BaccaratBetKind, number>
}

/** The bet that costs least right now — Banker, unless the shoe has turned. */
export function bestBet(edges: Record<BaccaratBetKind, number>): BaccaratBetKind {
  let best: BaccaratBetKind = 'banker'
  for (const kind of Object.keys(BACCARAT_BETS) as BaccaratBetKind[]) {
    if (edges[kind] < edges[best]) best = kind
  }
  return best
}
