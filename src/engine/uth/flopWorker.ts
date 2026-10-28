import type { Rank, Suit } from '../types'
import { flopEvs } from './strategy'

/**
 * Works out the flop call off the main thread. It is just over a million
 * hands: a fraction of a second on a laptop and longer on a phone — long
 * enough to stall the felt if the table did it itself.
 */

export interface FlopJob {
  id: number
  hole: Array<{ rank: Rank; suit: Suit }>
  flop: Array<{ rank: Rank; suit: Suit }>
}

self.onmessage = (event: MessageEvent<FlopJob>) => {
  const { id, hole, flop } = event.data
  self.postMessage({ id, evs: flopEvs(hole, flop) })
}
