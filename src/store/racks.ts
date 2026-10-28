import { useAppStore, type GameId } from './appStore'
import { useBaccaratStore } from './baccaratStore'
import { useCrapsStore } from './crapsStore'
import { useGameStore } from './gameStore'
import { useRouletteStore } from './rouletteStore'
import { useSharedBankroll } from './sharedBankroll'
import { clampStartingBankroll } from './stake'
import { useUthStore } from './uthStore'

/**
 * The racks on the floor, and whether they are five or one.
 *
 * By default every table keeps its own bankroll. The player can instead carry
 * one from table to table, so a win at craps is there to bet at roulette. Each
 * table still holds the rack itself — its engine bets from it, and its runs and
 * peaks are filed from it — so sharing is a matter of keeping the five in step:
 * whenever one rack moves, the other four move to match, with whatever they
 * have in play left where it is.
 */

/** What the floor needs from each table's store. */
interface Table {
  ready: boolean
  game: { bankroll: number }
  resetRack(amount: number): void
  matchRack(amount: number, save?: boolean): void
}

interface TableStore {
  getState(): Table
  subscribe(listener: (state: Table, prev: Table) => void): () => void
}

const TABLES: Record<GameId, TableStore> = {
  blackjack: useGameStore,
  craps: useCrapsStore,
  baccarat: useBaccaratStore,
  roulette: useRouletteStore,
  uth: useUthStore,
}
const IDS = Object.keys(TABLES) as GameId[]

/** Set while the floor is moving racks itself, so no move is carried twice. */
let moving = false

function quietly(fn: () => void) {
  const was = moving
  moving = true
  try {
    fn()
  } finally {
    moving = was
  }
}

/** One table's rack, carried to every other table that has its own loaded. */
function carry(from: GameId, amount: number) {
  quietly(() => {
    for (const id of IDS) {
      const table = TABLES[id].getState()
      if (id !== from && table.ready) table.matchRack(amount)
    }
  })
  useSharedBankroll.setState({ bankroll: amount })
}

/** One bankroll for every table, or one at each. */
export function setSharedBankroll(on: boolean): void {
  const { shared, bankroll } = useSharedBankroll.getState()
  if (on === shared) return
  if (on) {
    // The bankroll you carry is the rack from the table you were last at.
    const from = useAppStore.getState().lastGame ?? 'blackjack'
    useSharedBankroll.setState({ shared: true })
    carry(from, TABLES[from].getState().game.bankroll)
    return
  }
  // Each table keeps the figure it has now as its own rack again, and saves it:
  // while the bankroll was shared, only the floor did.
  useSharedBankroll.setState({ shared: false })
  for (const id of IDS) {
    const table = TABLES[id].getState()
    if (table.ready) table.matchRack(bankroll, true)
  }
}

for (const id of IDS) {
  TABLES[id].subscribe((state, prev) => {
    if (moving || !state.ready || !useSharedBankroll.getState().shared) return
    if (!prev.ready) {
      // Fresh from storage, with whatever figure the table last saved; the
      // floor's is the one that counts.
      quietly(() => state.matchRack(useSharedBankroll.getState().bankroll))
    } else if (state.game.bankroll !== prev.game.bankroll) {
      carry(id, state.game.bankroll)
    }
  })
}

/**
 * Every rack on the floor set to one figure, from the lobby — or, with the
 * bankroll shared, the one bankroll set to it.
 *
 * Either way this is the choice the lobby offers on each card, made five times
 * at once. A table that has been played closes its run first, filed with its
 * peak like a buy-back, and anything on the felt or in play is cleared rather
 * than waited for.
 */
export function resetAllRacks(amount: number): void {
  quietly(() => {
    for (const id of IDS) TABLES[id].getState().resetRack(amount)
  })
  if (useSharedBankroll.getState().shared) useSharedBankroll.setState({ bankroll: clampStartingBankroll(amount) })
}
