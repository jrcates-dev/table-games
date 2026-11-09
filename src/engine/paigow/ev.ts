import { createRng, seedRng } from '../rng'
import { DECK_SIZE, isPaiGow, QUEEN, topRank } from './hands'
import { houseWay } from './houseWay'
import { COMMISSION, type PaiGowRules } from './rules'
import { allSets, type SetHand } from './split'

/**
 * What a set is worth, in bets: the coach's number.
 *
 * Exact would mean setting every one of the 53 million hands the dealer could
 * hold. Instead the coach deals the dealer a few thousand of them from the 46
 * cards you cannot see, sets each the house way, and plays every one of your
 * 21 sets against the same sample. Because every set meets the same dealer
 * hands, the difference between two sets is far steadier than either number
 * alone — which is the number that matters ("this set costs you 4 cents a
 * dollar").
 */

export interface DealerSample {
  high: number
  low: number
  /** A queen-high pai gow in the high hand: a commission-free table pushes your win. */
  queenHigh: boolean
}

export const EV_SAMPLES = 4_000

/** Deal the dealer `n` hands from the cards you cannot see, each set the house way. */
export function sampleDealer(player: readonly number[], seed: number, rules: PaiGowRules, n = EV_SAMPLES): DealerSample[] {
  const unseen: number[] = []
  for (let c = 0; c < DECK_SIZE; c++) if (!player.includes(c)) unseen.push(c)
  const rng = createRng(seedRng(seed))
  const out: DealerSample[] = []
  const hand = [0, 0, 0, 0, 0, 0, 0]
  for (let k = 0; k < n; k++) {
    // A partial shuffle: the first seven of the unseen cards.
    for (let i = 0; i < 7; i++) {
      const j = i + rng.below(unseen.length - i)
      ;[unseen[i], unseen[j]] = [unseen[j], unseen[i]]
      hand[i] = unseen[i]
    }
    const { set } = houseWay(hand, rules)
    out.push({ high: set.highScore, low: set.lowScore, queenHigh: isPaiGow(set.highScore) && topRank(set.highScore) === QUEEN })
  }
  return out
}

/** A set's expected result per unit bet against the sampled dealer hands. A foul is −1. */
export function setEv(set: Pick<SetHand, 'highScore' | 'lowScore' | 'legal'>, samples: readonly DealerSample[], rules: PaiGowRules): number {
  if (!set.legal) return -1
  const win = rules.commissionFree ? 1 : 1 - COMMISSION
  let total = 0
  for (const d of samples) {
    const high = set.highScore > d.high
    const low = set.lowScore > d.low
    if (high && low) total += rules.commissionFree && d.queenHigh ? 0 : win
    else if (!high && !low) total -= 1
  }
  return total / samples.length
}

export interface SetEv {
  low: [number, number]
  ev: number
  legal: boolean
}

/** All 21 sets, valued against one sample of dealer hands. */
export function allSetEvs(player: readonly number[], samples: readonly DealerSample[], rules: PaiGowRules): SetEv[] {
  return allSets(player, rules).map((s) => ({ low: s.low, ev: setEv(s, samples, rules), legal: s.legal }))
}

/** What the worker is asked: your seven and the table's rules; it answers with the EV of every set. */
export interface EvJob {
  id: number
  player: number[]
  seed: number
  rules: PaiGowRules
}

export function evaluate(job: Omit<EvJob, 'id'>): SetEv[] {
  return allSetEvs(job.player, sampleDealer(job.player, job.seed, job.rules), job.rules)
}
