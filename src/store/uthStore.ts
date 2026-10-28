import { create } from 'zustand'
import { play } from '../audio'
import { cents } from '../engine/edge'
import { randomSeed } from '../engine/rng'
import type { Rank, Suit } from '../engine/types'
import type { Category } from '../engine/uth/poker'
import { DEFAULT_TRIPS_TABLE, UTH_LIMITS, UTH_STARTING_BANKROLL, type TripsTableId } from '../engine/uth/rules'
import type { FlopJob } from '../engine/uth/flopWorker'
import { advise, withinRack, type FlopEvs, type UthAdvice } from '../engine/uth/strategy'
import type { UthBets, UthDecision, UthState } from '../engine/uth/types'
import * as uth from '../engine/uth/uth'
import {
  afterRound,
  createSeatProfile,
  erased,
  openingStake,
  restartRun,
  SeatStorage,
  timerSet,
  withName,
  withSettings,
  type SeatProfile,
  type SeatSettingsBase,
} from './seat'

export interface UthStats {
  hands: number
  wins: number
  losses: number
  ties: number
  folds: number
  /** Raises by street: 4x or 3x before the flop, 2x on it, 1x on the river. */
  raisedPreflop: number
  raisedFlop: number
  raisedRiver: number
  decisions: number
  /** Decisions that matched the coach's. */
  bookDecisions: number
  dealerDidNotOpen: number
  tripsWon: number
  totalWagered: number
  netResult: number
  biggestWin: number
  biggestLoss: number
  /** Best hand made, as a score — higher is better. */
  bestScore: number
  bestName: string
}

const EMPTY_STATS: UthStats = {
  hands: 0,
  wins: 0,
  losses: 0,
  ties: 0,
  folds: 0,
  raisedPreflop: 0,
  raisedFlop: 0,
  raisedRiver: 0,
  decisions: 0,
  bookDecisions: 0,
  dealerDidNotOpen: 0,
  tripsWon: 0,
  totalWagered: 0,
  netResult: 0,
  biggestWin: 0,
  biggestLoss: 0,
  bestScore: 0,
  bestName: '',
}

export interface UthSettings extends SeatSettingsBase {
  dealSpeed: 'relaxed' | 'normal' | 'fast'
  tripsTable: TripsTableId
  /** Flag the book play on the buttons and say why. */
  coach: boolean
  showEdges: boolean
}

export const DEFAULT_UTH_SETTINGS: UthSettings = {
  dealSpeed: 'normal',
  tripsTable: DEFAULT_TRIPS_TABLE,
  coach: true,
  showEdges: true,
  startingBankroll: UTH_STARTING_BANKROLL,
}

type CardRecord = { rank: Rank; suit: Suit }

export interface HandRecord {
  id: string
  timestamp: number
  player: CardRecord[]
  dealer: CardRecord[]
  board: CardRecord[]
  playerName: string
  dealerName: string
  playerCategory: Category
  outcome: 'win' | 'lose' | 'tie' | 'fold'
  dealerQualifies: boolean
  raisedOn: UthState['raisedOn']
  raise: number
  bets: UthBets
  net: number
  /** Where the play left the book: "Checked A7o — the book raises 4x". */
  mistakes: string[]
}

export type UthProfile = SeatProfile<UthStats, UthSettings, HandRecord>

const VERSION = 1
const MAX_HISTORY = 200
const storage = new SeatStorage<UthProfile>('cta:uth:profile:v1', VERSION, DEFAULT_UTH_SETTINGS)
const timers = timerSet()

const PACE: Record<UthSettings['dealSpeed'], number> = { relaxed: 1.4, normal: 1, fast: 0.55 }

/** Card timing for the deal: seconds between cards and seconds in the air. */
export function uthDealTiming(speed: UthSettings['dealSpeed']) {
  const k = PACE[speed]
  return { interval: 0.22 * k, flight: 0.48 * Math.max(0.7, k) }
}

function freshProfile(startingBankroll: number): UthProfile {
  return createSeatProfile(VERSION, startingBankroll, EMPTY_STATS, DEFAULT_UTH_SETTINGS)
}

function newGame(profile: UthProfile): UthState {
  return uth.createGame(profile.bankroll, randomSeed(), UTH_LIMITS, profile.settings.tripsTable)
}

const SHORT: Record<UthDecision, string> = { check: 'Checked', bet4: 'Raised 4x', bet3: 'Raised 3x', bet2: 'Bet 2x', bet1: 'Bet 1x', fold: 'Folded' }

/** "A7o", "KQs", "99": how a hold'em player names two cards. */
export function holeName(cards: Array<{ rank: Rank; suit: Suit }>): string {
  const label = (r: Rank) => (r === '10' ? 'T' : r)
  const order = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const [a, b] = [...cards].sort((x, y) => order.indexOf(y.rank) - order.indexOf(x.rank))
  if (a.rank === b.rank) return `${label(a.rank)}${label(b.rank)}`
  return `${label(a.rank)}${label(b.rank)}${a.suit === b.suit ? 's' : 'o'}`
}

interface UthStore {
  game: UthState
  profile: UthProfile
  ready: boolean
  chip: number
  notice: string | null
  lastNet: number | null
  /** Board cards the table has turned so far — trails the engine through the run-out after a raise. */
  boardShown: number
  dealerShown: boolean
  /** The coach's call on each street this hand, against what was done. */
  calls: Array<{ advice: UthAdvice; chosen: UthDecision }>
  /** The flop worked out exactly, for the flop it was worked out on. */
  flopEvs: { key: string; evs: FlopEvs } | null

  init(): Promise<void>
  setChip(value: number): void
  placeAt(kind: 'ante' | 'trips'): void
  takeDown(kind: 'ante' | 'trips'): void
  clearBets(): void
  rebet(): void
  deal(): void
  rebetAndDeal(): void
  decide(decision: UthDecision): void
  setTripsTable(table: TripsTableId): void
  updateSettings(patch: Partial<UthSettings>): void
  setDisplayName(name: string): void
  rebuy(): void
  chooseBankroll(amount: number): void
  /** Set the rack to this amount whatever is in play, closing a played run first. */
  resetRack(amount: number): void
  /**
   * Move the rack to the figure the floor shares, leaving whatever is in play
   * where it is. Saved only when asked: while the bankroll is shared, the floor
   * keeps the figure.
   */
  matchRack(amount: number, save?: boolean): void
  dismissNotice(): void
  resetEverything(): void
}

let initialising: Promise<void> | null = null

export const useUthStore = create<UthStore>((set, get) => {
  const persist = () => storage.save(get().profile)
  const refuse = (reason?: string) => {
    if (reason) set({ notice: reason })
  }
  const sync = (game: UthState) => set({ game, profile: { ...get().profile, bankroll: game.bankroll } })
  const pace = () => PACE[get().profile.settings.dealSpeed]

  const record = (settled: UthState) => {
    const { profile, calls } = get()
    const result = settled.result!
    const net = uth.handNet(settled)
    const wagered = settled.resolutions.reduce((sum, r) => sum + r.stake, 0)
    const mistakes = calls
      .filter((c) => c.advice.decision !== c.chosen)
      .map((c) => `${SHORT[c.chosen]} ${c.advice.street === 'preflop' ? holeName(settled.player) : `on the ${c.advice.street}`} — the book says ${c.advice.headline.toLowerCase()}`)
    const stats: UthStats = {
      ...profile.stats,
      hands: profile.stats.hands + 1,
      wins: profile.stats.wins + (result.outcome === 'win' ? 1 : 0),
      losses: profile.stats.losses + (result.outcome === 'lose' ? 1 : 0),
      ties: profile.stats.ties + (result.outcome === 'tie' ? 1 : 0),
      folds: profile.stats.folds + (result.outcome === 'fold' ? 1 : 0),
      raisedPreflop: profile.stats.raisedPreflop + (settled.raisedOn === 'preflop' ? 1 : 0),
      raisedFlop: profile.stats.raisedFlop + (settled.raisedOn === 'flop' ? 1 : 0),
      raisedRiver: profile.stats.raisedRiver + (settled.raisedOn === 'river' ? 1 : 0),
      decisions: profile.stats.decisions + calls.length,
      bookDecisions: profile.stats.bookDecisions + calls.filter((c) => c.advice.decision === c.chosen).length,
      dealerDidNotOpen: profile.stats.dealerDidNotOpen + (result.dealerQualifies ? 0 : 1),
      tripsWon: profile.stats.tripsWon + (settled.resolutions.some((r) => r.kind === 'trips' && r.effect === 'win') ? 1 : 0),
      totalWagered: cents(profile.stats.totalWagered + wagered),
      netResult: cents(profile.stats.netResult + net),
      biggestWin: Math.max(profile.stats.biggestWin, net),
      biggestLoss: Math.min(profile.stats.biggestLoss, net),
      bestScore: Math.max(profile.stats.bestScore, result.playerScore),
      bestName: result.playerScore > profile.stats.bestScore ? result.playerName : profile.stats.bestName,
    }
    const card = ({ rank, suit }: CardRecord) => ({ rank, suit })
    const entry: HandRecord = {
      id: `${Date.now()}-${settled.seq}`,
      timestamp: Date.now(),
      player: settled.player.map(card),
      dealer: settled.dealer.map(card),
      board: settled.board.map(card),
      playerName: result.playerName,
      dealerName: result.dealerName,
      playerCategory: result.playerCategory,
      outcome: result.outcome,
      dealerQualifies: result.dealerQualifies,
      raisedOn: settled.raisedOn,
      raise: settled.raise,
      bets: settled.bets,
      net,
      mistakes,
    }
    set({
      lastNet: net,
      profile: { ...afterRound(profile, settled.bankroll), stats, history: [entry, ...profile.history].slice(0, MAX_HISTORY) },
    })
    persist()
  }

  /** After a raise or a fold: turn what is left of the board, then the dealer's cards, then pay. */
  const runOut = () => {
    let at = 450 * pace()
    const { boardShown } = get()
    if (boardShown < 3) {
      timers.schedule(() => set({ boardShown: 3 }), at)
      at += 750 * pace()
    }
    if (boardShown < 5) {
      timers.schedule(() => set({ boardShown: 5 }), at)
      at += 800 * pace()
    }
    timers.schedule(() => set({ dealerShown: true }), at)
    at += 1100 * pace()
    timers.schedule(() => {
      const settled = uth.settle(get().game)
      set({ game: settled })
      record(settled)
    }, at)
  }

  return {
    game: uth.createGame(UTH_STARTING_BANKROLL, 1, UTH_LIMITS),
    profile: freshProfile(UTH_STARTING_BANKROLL),
    ready: false,
    chip: 25,
    notice: null,
    lastNet: null,
    boardShown: 0,
    dealerShown: false,
    calls: [],
    flopEvs: null,

    async init() {
      initialising ??= (async () => {
        const profile = storage.load() ?? freshProfile(UTH_STARTING_BANKROLL)
        set({ profile, ready: true, game: newGame(profile) })
      })()
      return initialising
    },

    setChip(value) {
      play('click')
      set({ chip: value })
    },

    placeAt(kind) {
      const { game, chip } = get()
      if (game.phase !== 'betting' && game.phase !== 'showdown') return refuse('No more bets — the hand is out')
      const next = kind === 'ante' ? uth.placeAnte(game, chip) : uth.placeTrips(game, chip)
      if (next === game) {
        const on = game.phase === 'betting' ? game.bets[kind] : 0
        const max = kind === 'ante' ? game.limits.maxAnte : game.limits.maxTrips
        return refuse(on >= max ? `That is the table maximum on ${kind === 'ante' ? 'the Ante' : 'Trips'}` : 'Not enough in the rack')
      }
      play('chip')
      if (kind === 'ante') play('chip', { at: 0.09 })
      set({ notice: null, lastNet: null, boardShown: 0, dealerShown: false, calls: [] })
      sync(next)
      persist()
    },

    takeDown(kind) {
      const { game } = get()
      if (game.phase !== 'betting') return
      if (game.bets[kind] === 0) return
      play('click')
      sync(uth.removeBet(game, kind))
      persist()
    },

    /** Take everything back; once a hand is paid, clear the felt for new bets instead. */
    clearBets() {
      const { game } = get()
      const shown = game.phase === 'showdown'
      if (!shown && (game.phase !== 'betting' || uth.totalOnFelt(game) === 0)) return
      play('chipSlide')
      if (shown) set({ notice: null, lastNet: null, boardShown: 0, dealerShown: false, calls: [] })
      sync(uth.clearBets(uth.nextHand(game)))
      persist()
    },

    rebet() {
      const { game } = get()
      const next = uth.rebet(game)
      if (next === game) return refuse(game.lastBets.ante === 0 ? 'Nothing to rebet yet' : 'Not enough in the rack to rebet')
      play('chipStack', { count: 4 })
      set({ lastNet: null, boardShown: 0, dealerShown: false, calls: [] })
      sync(next)
      persist()
    },

    deal() {
      const { game } = get()
      if (game.phase === 'showdown') return get().rebetAndDeal()
      const check = uth.canDeal(game)
      if (!check.ok) return refuse(check.reason)
      timers.clear()
      set({ game: uth.deal(game), notice: null, lastNet: null, boardShown: 0, dealerShown: false, calls: [] })
    },

    rebetAndDeal() {
      const { game } = get()
      if (game.phase !== 'showdown') return
      const next = uth.rebet(game)
      if (next === game) return refuse('Not enough in the rack to rebet')
      play('chipStack', { count: 4 })
      sync(next)
      get().deal()
    },

    decide(decision) {
      const { game, calls } = get()
      if (!uth.legalDecisions(game).includes(decision)) return
      const advice = currentAdvice(game, get().flopEvs)
      const next = uth.decide(game, decision)
      if (next === game) return
      set({ calls: advice ? [...calls, { advice, chosen: decision }] : calls })
      if (decision === 'check') {
        play('click')
        set({ game: next, boardShown: next.revealed })
        if (next.phase === 'flop') {
          const key = flopKey(next)
          workOutFlop(next.player.map(bare), uth.visibleBoard(next).map(bare))?.then((evs) => {
            if (flopKey(get().game) === key) set({ flopEvs: { key, evs } })
          })
        }
        return
      }
      if (decision === 'fold') play('cardSweep')
      else play('chipStack', { count: Math.min(8, 2 + next.raise) })
      sync(next)
      runOut()
    },

    setTripsTable(tripsTable) {
      const { game, profile } = get()
      const next = uth.setTripsTable(game, tripsTable)
      if (next === game && game.tripsTable !== tripsTable) return refuse('Change the pay table between hands')
      set({ game: next, profile: withSettings(profile, { tripsTable }) })
      persist()
    },

    updateSettings(patch) {
      if (patch.tripsTable && patch.tripsTable !== get().game.tripsTable) get().setTripsTable(patch.tripsTable)
      set({ profile: withSettings(get().profile, patch) })
      persist()
    },

    setDisplayName(name) {
      set({ profile: withName(get().profile, name) })
      persist()
    },

    rebuy() {
      timers.clear()
      const profile = restartRun(get().profile)
      set({ profile, game: newGame(profile), lastNet: null, notice: null, boardShown: 0, dealerShown: false, calls: [] })
      persist()
    },

    chooseBankroll(amount) {
      const state = get()
      if (!selectCanChooseUthBankroll(state) || amount === state.profile.bankroll) return
      get().resetRack(amount)
    },

    resetRack(amount) {
      const state = get()
      if (selectUthHasRun(state)) {
        set({ profile: withSettings(state.profile, { startingBankroll: amount }) })
        get().rebuy()
        return
      }
      timers.clear()
      const profile = openingStake(state.profile, amount)
      set({ profile, game: newGame(profile), lastNet: null, notice: null, boardShown: 0, dealerShown: false, calls: [] })
      persist()
    },

    matchRack(amount, save = false) {
      const { game, profile } = get()
      if (amount !== game.bankroll) {
        set({ game: { ...game, bankroll: amount }, profile: { ...profile, bankroll: profile.bankroll + amount - game.bankroll } })
      }
      if (save) persist()
    },

    dismissNotice() {
      set({ notice: null })
    },

    resetEverything() {
      timers.clear()
      const profile = erased(get().profile, freshProfile)
      set({ profile, game: newGame(profile), lastNet: null, notice: null, boardShown: 0, dealerShown: false, calls: [] })
      persist()
    },
  }
})

export const selectCanChooseUthBankroll = (s: UthStore) => s.ready && (s.game.phase === 'betting' || s.game.phase === 'showdown')
export const selectUthHasRun = (s: UthStore) => s.profile.stats.hands > 0

/** Chips in the circles that are still the player's to lose. */
export function uthAtRisk(game: UthState): number {
  return game.phase === 'showdown' ? 0 : uth.totalOnFelt(game)
}

const bare = ({ rank, suit }: CardRecord): CardRecord => ({ rank, suit })

/** Names the hand and the cards face up, so a flop's EVs can never land on another flop. */
function flopKey(game: UthState): string {
  return `${game.seq}:${[...game.player, ...uth.visibleBoard(game)].map((c) => c.rank + c.suit).join(' ')}`
}

let flopWorker: Worker | null | undefined
let nextJob = 0
const flopJobs = new Map<number, (evs: FlopEvs) => void>()

/**
 * The exact flop call, worked out in a worker so the felt never stalls. Null
 * where there are no workers (the tests); the coach keeps the simple rule then.
 */
function workOutFlop(hole: CardRecord[], flop: CardRecord[]): Promise<FlopEvs> | null {
  if (flopWorker === undefined) {
    flopWorker = typeof Worker === 'undefined' ? null : new Worker(new URL('../engine/uth/flopWorker.ts', import.meta.url), { type: 'module' })
    flopWorker?.addEventListener('message', (event: MessageEvent<{ id: number; evs: FlopEvs }>) => {
      flopJobs.get(event.data.id)?.(event.data.evs)
      flopJobs.delete(event.data.id)
    })
    flopWorker?.addEventListener('error', () => {
      flopWorker = null
      flopJobs.clear()
    })
  }
  if (!flopWorker) return null
  const job: FlopJob = { id: nextJob++, hole, flop }
  flopWorker.postMessage(job)
  return new Promise((resolve) => flopJobs.set(job.id, resolve))
}

let adviceCache: { key: string; advice: UthAdvice | null } | null = null

/**
 * The coach's call for the street the hand is on, if a decision is pending —
 * worked out once per street, again when the exact flop EVs arrive, and kept
 * to what the rack can cover.
 */
export function currentAdvice(game: UthState, flop: UthStore['flopEvs'] = null): UthAdvice | null {
  if (game.phase !== 'preflop' && game.phase !== 'flop' && game.phase !== 'river') return null
  const exact = game.phase === 'flop' && flop?.key === flopKey(game) ? flop.evs : undefined
  const legal = uth.legalDecisions(game)
  const key = `${flopKey(game)}:${game.phase}:${legal.join()}:${exact ? 'exact' : 'rule'}`
  if (adviceCache?.key !== key) {
    const advice = advise(game.player, uth.visibleBoard(game), exact)
    adviceCache = { key, advice: advice && withinRack(advice, legal, game.player) }
  }
  return adviceCache.advice
}
