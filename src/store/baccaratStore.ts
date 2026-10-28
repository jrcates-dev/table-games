import { useMemo } from 'react'
import { create } from 'zustand'
import { play } from '../audio'
import * as bac from '../engine/baccarat/baccarat'
import { coupOdds, houseEdges, remainingRanks, type CoupOdds } from '../engine/baccarat/odds'
import { BACCARAT_BETS, BACCARAT_DECKS, BACCARAT_LIMITS, BACCARAT_STARTING_BANKROLL } from '../engine/baccarat/rules'
import type { BaccaratBetKind, BaccaratBets, BaccaratResolution, BaccaratState, Coup, CoupCard, Winner } from '../engine/baccarat/types'
import { cents } from '../engine/edge'
import { randomSeed } from '../engine/rng'
import type { Rank, Suit } from '../engine/types'
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

export interface BaccaratStats {
  coups: number
  playerWins: number
  bankerWins: number
  ties: number
  naturals: number
  shoes: number
  totalWagered: number
  netResult: number
  /** What the 5% has cost, in total. */
  commissionPaid: number
  biggestWin: number
  biggestLoss: number
  sideBetsWon: number
}

const EMPTY_STATS: BaccaratStats = {
  coups: 0,
  playerWins: 0,
  bankerWins: 0,
  ties: 0,
  naturals: 0,
  shoes: 0,
  totalWagered: 0,
  netResult: 0,
  commissionPaid: 0,
  biggestWin: 0,
  biggestLoss: 0,
  sideBetsWon: 0,
}

export interface BaccaratSettings extends SeatSettingsBase {
  dealSpeed: 'relaxed' | 'normal' | 'fast'
  /** Colour every bet by what the house keeps. */
  showEdges: boolean
  /**
   * Price every bet from the cards still in the shoe rather than a full one.
   * The main bets barely move; the side bets can swing, and now and then go
   * over to the player.
   */
  liveOdds: boolean
  /** Unfold the last coup on the rail: every draw and every bet, with the reason. */
  showCoupDetail: boolean
}

export const DEFAULT_BACCARAT_SETTINGS: BaccaratSettings = {
  dealSpeed: 'normal',
  showEdges: true,
  liveOdds: true,
  showCoupDetail: true,
  startingBankroll: BACCARAT_STARTING_BANKROLL,
}

export interface CoupRecord {
  id: string
  timestamp: number
  winner: Winner
  playerTotal: number
  bankerTotal: number
  player: Array<{ rank: Rank; suit: Suit }>
  banker: Array<{ rank: Rank; suit: Suit }>
  bets: BaccaratBets
  net: number
}

export type BaccaratProfile = SeatProfile<BaccaratStats, BaccaratSettings, CoupRecord>

const VERSION = 1
const MAX_HISTORY = 200
const storage = new SeatStorage<BaccaratProfile>('cta:baccarat:profile:v1', VERSION, DEFAULT_BACCARAT_SETTINGS)
const timers = timerSet()

function freshProfile(startingBankroll: number): BaccaratProfile {
  return createSeatProfile(VERSION, startingBankroll, EMPTY_STATS, DEFAULT_BACCARAT_SETTINGS)
}

function newGame(profile: BaccaratProfile): BaccaratState {
  return bac.createGame(profile.bankroll, randomSeed(), BACCARAT_LIMITS)
}

/**
 * How the dealer turns a coup over, in steps. The engine has dealt the whole
 * coup at once; the table plays it back the way the game is run: four cards
 * out face down, the Player hand turned, the Banker hand turned, then each
 * third card the tableau calls for, dealt face up, one at a time.
 */
export const REVEAL = {
  /** Four cards out. */
  dealt: 0,
  player: 1,
  banker: 2,
  /** The fifth card off the shoe, then the sixth. */
  thirdA: 3,
  thirdB: 4,
} as const

const PACE: Record<BaccaratSettings['dealSpeed'], number> = { relaxed: 1.4, normal: 1, fast: 0.55 }
/** Seconds between cards in the opening four, and in the air. */
export function dealTiming(speed: BaccaratSettings['dealSpeed']) {
  const k = PACE[speed]
  return { interval: 0.3 * k, flight: 0.5 * Math.max(0.7, k) }
}

/** Whether this card is on the felt yet, and whether it is face up, at a step of the reveal. */
export function cardAt(card: CoupCard, step: number): { out: boolean; faceDown: boolean } {
  if (card.seq < 4) {
    const turned = card.side === 'player' ? step >= REVEAL.player : step >= REVEAL.banker
    return { out: true, faceDown: !turned }
  }
  const arrives = card.seq === 4 ? REVEAL.thirdA : REVEAL.thirdB
  return { out: step >= arrives, faceDown: false }
}

interface BaccaratStore {
  game: BaccaratState
  profile: BaccaratProfile
  ready: boolean
  chip: number
  notice: string | null
  /** How far into turning the coup over the dealer is; see `REVEAL`. */
  step: number
  lastNet: number | null
  /**
   * The coup just settled, kept after the felt reopens so it can still be
   * explained while the next bets go down — until the next coup replaces it.
   */
  lastCoup: { seq: number; coup: Coup; resolutions: BaccaratResolution[] } | null

  init(): Promise<void>
  setChip(value: number): void
  placeAt(kind: BaccaratBetKind): void
  takeDown(kind: BaccaratBetKind): void
  clearBets(): void
  rebet(): void
  deal(): void
  /** Settled: put the same bets back down and deal again. */
  rebetAndDeal(): void
  updateSettings(patch: Partial<BaccaratSettings>): void
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

const NEW_SHOE = 'The cut card is out — a new shoe, shuffled and burned'
/** A new shoe is worth hearing about even as the bet that opened it goes down. */
const keepShoeNotice = (notice: string | null) => (notice === NEW_SHOE ? NEW_SHOE : null)

export const useBaccaratStore = create<BaccaratStore>((set, get) => {
  const persist = () => storage.save(get().profile)
  const refuse = (reason?: string) => {
    if (reason) set({ notice: reason })
  }

  /** The felt reopens: last coup's cards off, and a new shoe if the cut card came out. */
  const reopen = (game: BaccaratState): BaccaratState => {
    if (game.phase !== 'settled') return game
    const next = bac.nextCoup(game)
    if (next.shoe !== game.shoe) {
      play('shuffle', { at: 0.3 })
      set({ notice: NEW_SHOE })
      set({ profile: { ...get().profile, stats: { ...get().profile.stats, shoes: get().profile.stats.shoes + 1 } } })
    }
    return next
  }

  const record = (settled: BaccaratState) => {
    const { profile } = get()
    const coup = settled.coup!
    const net = bac.coupNet(settled)
    const wagered = settled.resolutions.filter((r) => r.effect !== 'push').reduce((sum, r) => sum + r.stake, 0)
    const banker = settled.resolutions.find((r) => r.kind === 'banker' && r.effect === 'win')
    const stats: BaccaratStats = {
      ...profile.stats,
      coups: profile.stats.coups + 1,
      playerWins: profile.stats.playerWins + (coup.winner === 'player' ? 1 : 0),
      bankerWins: profile.stats.bankerWins + (coup.winner === 'banker' ? 1 : 0),
      ties: profile.stats.ties + (coup.winner === 'tie' ? 1 : 0),
      naturals: profile.stats.naturals + (coup.natural ? 1 : 0),
      totalWagered: cents(profile.stats.totalWagered + wagered),
      netResult: cents(profile.stats.netResult + net),
      commissionPaid: cents(profile.stats.commissionPaid + (banker ? banker.stake - banker.net : 0)),
      biggestWin: Math.max(profile.stats.biggestWin, net),
      biggestLoss: Math.min(profile.stats.biggestLoss, net),
      sideBetsWon: profile.stats.sideBetsWon + settled.resolutions.filter((r) => BACCARAT_BETS[r.kind].side && r.effect === 'win').length,
    }
    const entry: CoupRecord = {
      id: `${Date.now()}-${settled.seq}`,
      timestamp: Date.now(),
      winner: coup.winner,
      playerTotal: coup.playerTotal,
      bankerTotal: coup.bankerTotal,
      player: coup.player.map(({ rank, suit }) => ({ rank, suit })),
      banker: coup.banker.map(({ rank, suit }) => ({ rank, suit })),
      bets: settled.lastBets,
      net,
    }
    set({
      lastNet: net,
      profile: { ...afterRound(profile, settled.bankroll), stats, history: [entry, ...profile.history].slice(0, MAX_HISTORY) },
    })
    persist()
  }

  const sync = (game: BaccaratState) => set({ game, profile: { ...get().profile, bankroll: game.bankroll } })

  return {
    game: bac.createGame(BACCARAT_STARTING_BANKROLL, 1, BACCARAT_LIMITS),
    profile: freshProfile(BACCARAT_STARTING_BANKROLL),
    ready: false,
    chip: 25,
    notice: null,
    step: 0,
    lastNet: null,
    lastCoup: null,

    async init() {
      initialising ??= (async () => {
        const profile = storage.load() ?? freshProfile(BACCARAT_STARTING_BANKROLL)
        set({ profile, ready: true, game: newGame(profile) })
      })()
      return initialising
    },

    setChip(value) {
      play('click')
      set({ chip: value })
    },

    placeAt(kind) {
      const game = reopen(get().game)
      const check = bac.canPlace(game, kind)
      if (!check.ok) return refuse(check.reason)
      const on = game.bets[kind] ?? 0
      const next = bac.placeBet(game, kind, on === 0 ? Math.max(get().chip, bac.minFor(game, kind)) : get().chip)
      if (next === game) return refuse('Not enough in the rack')
      play('chip')
      set({ notice: keepShoeNotice(get().notice), lastNet: null, step: 0 })
      sync(next)
      persist()
    },

    takeDown(kind) {
      const { game } = get()
      if (game.phase === 'dealt') return refuse('No more bets — the cards are out')
      if (!game.bets[kind] || game.phase !== 'betting') return
      play('click')
      sync(bac.removeBet(game, kind))
      persist()
    },

    /** Take everything back; once a coup is paid, clear the felt for new bets instead. */
    clearBets() {
      const { game } = get()
      if (game.phase === 'dealt') return
      if (game.phase === 'settled') set({ lastNet: null, step: 0 })
      play('click')
      sync(bac.clearBets(reopen(game)))
      persist()
    },

    rebet() {
      const game = reopen(get().game)
      const next = bac.rebet(game)
      if (next === game) return refuse(Object.keys(game.lastBets).length === 0 ? 'Nothing to rebet yet' : 'Not enough in the rack to rebet')
      play('chipStack', { count: 4 })
      set({ lastNet: null, step: 0 })
      sync(next)
      persist()
    },

    deal() {
      const { game, profile } = get()
      if (game.phase === 'settled') return get().rebetAndDeal()
      const check = bac.canDeal(game)
      if (!check.ok) return refuse(check.reason)
      timers.clear()
      const dealt = bac.deal(game)
      set({ game: dealt, step: REVEAL.dealt, notice: keepShoeNotice(get().notice), lastNet: null })

      const { interval, flight } = dealTiming(profile.settings.dealSpeed)
      const pace = PACE[profile.settings.dealSpeed]
      const coup = dealt.coup!
      const thirds = coup.player.length + coup.banker.length - 4
      let at = (4 * interval + flight + 0.35) * 1000
      timers.schedule(() => set({ step: REVEAL.player }), at)
      at += 850 * pace
      timers.schedule(() => set({ step: REVEAL.banker }), at)
      if (thirds >= 1) {
        at += 900 * pace
        timers.schedule(() => set({ step: REVEAL.thirdA }), at)
      }
      if (thirds >= 2) {
        at += 900 * pace
        timers.schedule(() => set({ step: REVEAL.thirdB }), at)
      }
      at += (thirds > 0 ? flight * 1000 : 0) + 650 * pace
      timers.schedule(() => {
        const settled = bac.settle(get().game)
        set({ game: settled, lastCoup: { seq: settled.seq, coup: settled.coup!, resolutions: settled.resolutions } })
        record(settled)
      }, at)
    },

    rebetAndDeal() {
      const { game } = get()
      if (game.phase !== 'settled') return
      const reopened = reopen(game)
      const next = bac.rebet(reopened)
      if (next === reopened) {
        sync(reopened)
        return refuse('Not enough in the rack to rebet')
      }
      play('chipStack', { count: 4 })
      sync(next)
      get().deal()
    },

    updateSettings(patch) {
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
      set({ profile, game: newGame(profile), lastNet: null, lastCoup: null, notice: null, step: 0 })
      persist()
    },

    chooseBankroll(amount) {
      const state = get()
      if (!selectCanChooseBaccaratBankroll(state) || amount === state.profile.bankroll) return
      get().resetRack(amount)
    },

    resetRack(amount) {
      const state = get()
      if (selectBaccaratHasRun(state)) {
        set({ profile: withSettings(state.profile, { startingBankroll: amount }) })
        get().rebuy()
        return
      }
      timers.clear()
      const profile = openingStake(state.profile, amount)
      set({ profile, game: newGame(profile), lastNet: null, lastCoup: null, notice: null, step: 0 })
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
      set({ profile, game: newGame(profile), lastNet: null, lastCoup: null, notice: null, step: 0 })
      persist()
    },
  }
})

export const selectCanChooseBaccaratBankroll = (s: BaccaratStore) => s.ready && s.game.phase !== 'dealt'
export const selectBaccaratHasRun = (s: BaccaratStore) => s.profile.stats.coups > 0

/** Chips on the felt that are still the player's to lose. */
export function baccaratAtRisk(game: BaccaratState): number {
  return game.phase === 'settled' ? 0 : bac.totalOnFelt(game)
}

export interface LiveOdds {
  edges: Record<BaccaratBetKind, number>
  odds: CoupOdds
  /** Cards left in the shoe the figures were worked out from. */
  cardsLeft: number
  live: boolean
}

const FULL_SHOE = remainingRanks(BACCARAT_DECKS, [])
const FULL: LiveOdds = (() => ({ edges: houseEdges(FULL_SHOE), odds: coupOdds(FULL_SHOE), cardsLeft: BACCARAT_DECKS * 52, live: false }))()

/** One shoe position, priced once however many panels ask. */
let liveCache: { key: string; value: LiveOdds } | null = null

/**
 * Every bet priced from the cards left in the shoe, as of the last time the
 * felt was open. Held steady while a coup is out, so the numbers never move
 * on cards that have not been turned over yet.
 */
export function useLiveOdds(): LiveOdds {
  const game = useBaccaratStore((s) => s.game)
  const live = useBaccaratStore((s) => s.profile.settings.liveOdds)
  const key = `${game.shoe.shuffleCount}:${game.shoe.pos}`
  return useMemo(() => {
    if (!live) return FULL
    // While the coup is being turned over the shoe has moved past cards nobody
    // has seen yet, so the prices from before the deal stand until it settles.
    if (game.phase === 'dealt' && liveCache) return liveCache.value
    if (liveCache?.key === key) return liveCache.value
    const ranks = remainingRanks(BACCARAT_DECKS, bac.seenCards(game))
    const value: LiveOdds = {
      edges: houseEdges(ranks),
      odds: coupOdds(ranks),
      cardsLeft: Object.values(ranks).reduce((a, b) => a + b, 0),
      live: true,
    }
    liveCache = { key, value }
    return value
    // The shoe position is the only thing the figures depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, live, game.phase])
}
