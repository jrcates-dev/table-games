import { create } from 'zustand'
import { play } from '../audio'
import { cents } from '../engine/edge'
import { evaluate, type EvJob, type SetEv } from '../engine/paigow/ev'
import { FORTUNE_LABEL, FORTUNE_ORDER, type FortuneHand } from '../engine/paigow/fortune'
import { cardText } from '../engine/paigow/hands'
import { houseWay } from '../engine/paigow/houseWay'
import * as pg from '../engine/paigow/paigow'
import { DEFAULT_PAIGOW_RULES, PAIGOW_LIMITS, PAIGOW_STARTING_BANKROLL, type PaiGowRules } from '../engine/paigow/rules'
import { sameLow, setHand, type SetHand } from '../engine/paigow/split'
import type { PaiGowBets, PaiGowResult, PaiGowState } from '../engine/paigow/types'
import { randomSeed } from '../engine/rng'
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
import { tableSnapshot } from './tableSnapshot'

export interface PaiGowStats {
  hands: number
  wins: number
  pushes: number
  losses: number
  fouls: number
  /** Hands where a foul was on the felt and was fixed before the hand was set. */
  foulsAvoided: number
  /** Hands set exactly as the house way sets them. */
  houseWaySets: number
  /** Hands the coach could value, and what departing from the house way cost in all, in bets. */
  valued: number
  evGivenUp: number
  commissionPaid: number
  fortuneBets: number
  fortuneHits: number
  /** The best Fortune hand made, by its place in the pay table (lower is better); -1 for none. */
  bestFortune: number
  totalWagered: number
  netResult: number
  biggestWin: number
  biggestLoss: number
}

const EMPTY_STATS: PaiGowStats = {
  hands: 0,
  wins: 0,
  pushes: 0,
  losses: 0,
  fouls: 0,
  foulsAvoided: 0,
  houseWaySets: 0,
  valued: 0,
  evGivenUp: 0,
  commissionPaid: 0,
  fortuneBets: 0,
  fortuneHits: 0,
  bestFortune: -1,
  totalWagered: 0,
  netResult: 0,
  biggestWin: 0,
  biggestLoss: 0,
}

export interface PaiGowSettings extends SeatSettingsBase {
  dealSpeed: 'relaxed' | 'normal' | 'fast'
  commissionFree: boolean
  wheelSecond: boolean
  /** Mark the house way on the cards and say what each set is worth. */
  coach: boolean
  showEdges: boolean
}

export const DEFAULT_PAIGOW_SETTINGS: PaiGowSettings = {
  dealSpeed: 'normal',
  commissionFree: DEFAULT_PAIGOW_RULES.commissionFree,
  wheelSecond: DEFAULT_PAIGOW_RULES.wheelSecond,
  coach: true,
  showEdges: true,
  startingBankroll: PAIGOW_STARTING_BANKROLL,
}

export interface HandRecord {
  id: string
  timestamp: number
  /** Card shorthand ("AS", "JK"), each side highest first. */
  player: string[]
  dealer: string[]
  playerLow: [number, number]
  dealerLow: [number, number]
  playerHigh: string
  playerLowName: string
  dealerHigh: string
  dealerLowName: string
  outcome: PaiGowResult['outcome']
  fortune: FortuneHand | null
  bets: PaiGowBets
  net: number
  houseWay: boolean
  /** What the set cost against the house way's, in bets; null where the coach had no numbers. */
  evCost: number | null
}

export type PaiGowProfile = SeatProfile<PaiGowStats, PaiGowSettings, HandRecord>

const VERSION = 1
const MAX_HISTORY = 200
const storage = new SeatStorage<PaiGowProfile>('cta:paigow:profile:v1', VERSION, DEFAULT_PAIGOW_SETTINGS)
const timers = timerSet()

/** The felt, saved as it changes so closing the app mid-hand loses nothing (see tableSnapshot.ts). */
interface PaiGowFelt {
  game: PaiGowState
  low: number[]
  foulSeen: boolean
}
const felt = tableSnapshot<PaiGowFelt>('cta:paigow:felt:v1', 1)

const PACE: Record<PaiGowSettings['dealSpeed'], number> = { relaxed: 1.4, normal: 1, fast: 0.55 }

/** Card timing for the deal: seconds between cards and seconds in the air. */
export function paigowDealTiming(speed: PaiGowSettings['dealSpeed']) {
  const k = PACE[speed]
  return { interval: 0.13 * k, flight: 0.44 * Math.max(0.7, k) }
}

const rulesOf = (settings: PaiGowSettings): PaiGowRules => ({ commissionFree: settings.commissionFree, wheelSecond: settings.wheelSecond })

function freshProfile(startingBankroll: number): PaiGowProfile {
  return createSeatProfile(VERSION, startingBankroll, EMPTY_STATS, DEFAULT_PAIGOW_SETTINGS)
}

function newGame(profile: PaiGowProfile): PaiGowState {
  return pg.createGame(profile.bankroll, randomSeed(), PAIGOW_LIMITS, rulesOf(profile.settings))
}

/**
 * The dealer's cards, as the table has shown them so far: face down, turned
 * over where they were dealt, then set into the two hands.
 */
export type DealerStage = 'down' | 'turned' | 'set'

interface PaiGowStore {
  game: PaiGowState
  profile: PaiGowProfile
  ready: boolean
  chip: number
  notice: string | null
  lastNet: number | null
  /** The cards you have moved to the low hand so far, by index into your seven. */
  low: number[]
  /** A foul has been on the felt this hand, whether or not it was set. */
  foulSeen: boolean
  dealerStage: DealerStage
  /** Every set's value against a sample of dealer hands, for the hand it was worked out for. */
  evs: { seq: number; evs: SetEv[] } | null

  init(): Promise<void>
  setChip(value: number): void
  placeAt(kind: keyof PaiGowBets): void
  takeDown(kind: keyof PaiGowBets): void
  clearBets(): void
  rebet(): void
  deal(): void
  rebetAndDeal(): void
  /** Move a card between the hands: into the low hand, or back out of it. */
  toggleCard(index: number): void
  /** Take both cards back out of the low hand. */
  clearLow(): void
  /** Put the cards exactly as the house way sets them. */
  setHouseWay(): void
  /** Set the hand as it lies and turn the dealer's over. */
  confirmSet(): void
  updateSettings(patch: Partial<PaiGowSettings>): void
  setDisplayName(name: string): void
  rebuy(): void
  chooseBankroll(amount: number): void
  resetRack(amount: number): void
  matchRack(amount: number, save?: boolean): void
  dismissNotice(): void
  resetEverything(): void
}

let initialising: Promise<void> | null = null

export const usePaiGowStore = create<PaiGowStore>((set, get) => {
  const persist = () => storage.save(get().profile)
  const refuse = (reason?: string) => {
    if (reason) set({ notice: reason })
  }
  const sync = (game: PaiGowState) => set({ game, profile: { ...get().profile, bankroll: game.bankroll } })
  const pace = () => PACE[get().profile.settings.dealSpeed]
  const clean = { notice: null, lastNet: null, low: [] as number[], foulSeen: false, dealerStage: 'down' as DealerStage }

  const record = (settled: PaiGowState, low: number[]) => {
    const { profile, foulSeen, evs } = get()
    const result = settled.result!
    const stats = profile.stats
    const net = pg.handNet(settled)
    const wagered = settled.resolutions.reduce((sum, r) => sum + r.stake, 0)
    const cards = pg.playerCodes(settled)
    const house = houseWay(cards, settled.rules).set
    const mine = setHand(cards, low, settled.rules)
    const byHouse = sameSet(mine, house)
    const cost = evs?.seq === settled.seq ? evCost(evs.evs, mine, house) : null
    const main = settled.resolutions.find((r) => r.kind === 'wager')!
    const fortune = settled.resolutions.find((r) => r.kind === 'fortune')
    const fortuneRank = result.fortune ? FORTUNE_ORDER.indexOf(result.fortune) : -1
    const next: PaiGowStats = {
      hands: stats.hands + 1,
      wins: stats.wins + (result.outcome === 'win' ? 1 : 0),
      pushes: stats.pushes + (result.outcome === 'push' ? 1 : 0),
      losses: stats.losses + (result.outcome === 'lose' ? 1 : 0),
      fouls: stats.fouls + (result.outcome === 'foul' ? 1 : 0),
      foulsAvoided: stats.foulsAvoided + (foulSeen && !result.foul ? 1 : 0),
      houseWaySets: stats.houseWaySets + (byHouse ? 1 : 0),
      valued: stats.valued + (cost === null ? 0 : 1),
      evGivenUp: cost === null ? stats.evGivenUp : stats.evGivenUp + cost,
      commissionPaid: cents(stats.commissionPaid + (result.outcome === 'win' && !settled.rules.commissionFree ? main.stake - main.net : 0)),
      fortuneBets: stats.fortuneBets + (fortune ? 1 : 0),
      fortuneHits: stats.fortuneHits + (fortune?.effect === 'win' ? 1 : 0),
      bestFortune: fortuneRank >= 0 && (stats.bestFortune < 0 || fortuneRank < stats.bestFortune) ? fortuneRank : stats.bestFortune,
      totalWagered: cents(stats.totalWagered + wagered),
      netResult: cents(stats.netResult + net),
      biggestWin: Math.max(stats.biggestWin, net),
      biggestLoss: Math.min(stats.biggestLoss, net),
    }
    const entry: HandRecord = {
      id: `${Date.now()}-${settled.seq}`,
      timestamp: Date.now(),
      player: cards.map(cardText),
      dealer: pg.dealerCodes(settled).map(cardText),
      playerLow: result.player.low,
      dealerLow: result.dealer.low,
      playerHigh: result.player.highName,
      playerLowName: result.player.lowName,
      dealerHigh: result.dealer.highName,
      dealerLowName: result.dealer.lowName,
      outcome: result.outcome,
      fortune: result.fortune,
      bets: settled.bets,
      net,
      houseWay: byHouse,
      evCost: cost,
    }
    set({
      lastNet: net,
      profile: { ...afterRound(profile, settled.bankroll), stats: next, history: [entry, ...profile.history].slice(0, MAX_HISTORY) },
    })
    persist()
  }

  /** Value every set for the coach, off the main thread. */
  const valueSets = (game: PaiGowState) => {
    const seq = game.seq
    const job = { player: pg.playerCodes(game), seed: seq * 7_919 + game.player[0].code, rules: game.rules }
    workOut(job).then((evs) => {
      if (get().game.seq === seq) set({ evs: { seq, evs } })
    })
  }

  /** After the set goes down: the dealer's cards turn, are set the house way, and the hand is paid. */
  const reveal = () => {
    let at = 350 * pace()
    timers.schedule(() => {
      play('cardFlip')
      set({ dealerStage: 'turned' })
    }, at)
    at += 1000 * pace()
    timers.schedule(() => {
      play('card')
      set({ dealerStage: 'set' })
    }, at)
    at += 1200 * pace()
    timers.schedule(() => {
      const { game, low } = get()
      const settled = pg.settle(game)
      set({ game: settled })
      record(settled, low)
    }, at)
  }

  /** Whether the cards as they lie would foul, and note it if so. */
  const watchFoul = (low: number[]) => {
    const { game } = get()
    if (low.length !== 2) return
    if (!setHand(pg.playerCodes(game), low, game.rules).legal) set({ foulSeen: true })
  }

  return {
    game: pg.createGame(PAIGOW_STARTING_BANKROLL, 1, PAIGOW_LIMITS),
    profile: freshProfile(PAIGOW_STARTING_BANKROLL),
    ready: false,
    chip: 25,
    notice: null,
    lastNet: null,
    low: [],
    foulSeen: false,
    dealerStage: 'down',
    evs: null,

    async init() {
      initialising ??= (async () => {
        const profile = storage.load() ?? freshProfile(PAIGOW_STARTING_BANKROLL)
        const saved = felt.load(profile.runStartedAt)
        if (saved && paigowAtRisk(saved.game) > 0) {
          // The app closed with chips down: the hand comes back as it was.
          const { game } = saved
          set({ profile: { ...profile, bankroll: game.bankroll }, ready: true, game, low: saved.low ?? [], foulSeen: saved.foulSeen ?? false, dealerStage: 'down' })
          if (game.phase === 'setting') valueSets(game)
          if (game.phase === 'reveal') {
            // The hand was set before the close: it was decided, so pay it.
            const settled = pg.settle(game)
            set({ game: settled, dealerStage: 'set' })
            record(settled, game.result!.player.low)
          }
          return
        }
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
      const next = kind === 'wager' ? pg.placeWager(game, chip) : pg.placeFortune(game, chip)
      if (next === game) {
        const on = game.phase === 'betting' ? game.bets[kind] : 0
        const max = kind === 'wager' ? game.limits.maxBet : game.limits.maxFortune
        return refuse(on >= max ? `That is the table maximum on ${kind === 'wager' ? 'the bet' : 'Fortune'}` : 'Not enough in the rack')
      }
      play('chip')
      set(clean)
      sync(next)
      persist()
    },

    takeDown(kind) {
      const { game } = get()
      if (game.phase !== 'betting' || game.bets[kind] === 0) return
      play('click')
      sync(pg.removeBet(game, kind))
      persist()
    },

    clearBets() {
      const { game } = get()
      const shown = game.phase === 'showdown'
      if (!shown && (game.phase !== 'betting' || pg.totalOnFelt(game) === 0)) return
      play('chipSlide')
      if (shown) set(clean)
      sync(pg.clearBets(pg.nextHand(game)))
      persist()
    },

    rebet() {
      const { game } = get()
      const next = pg.rebet(game)
      if (next === game) return refuse(game.lastBets.wager === 0 ? 'Nothing to rebet yet' : 'Not enough in the rack to rebet')
      play('chipStack', { count: 4 })
      set(clean)
      sync(next)
      persist()
    },

    deal() {
      const { game } = get()
      if (game.phase === 'showdown') return get().rebetAndDeal()
      const check = pg.canDeal(game)
      if (!check.ok) return refuse(check.reason)
      timers.clear()
      const next = pg.deal(game)
      set({ ...clean, game: next, evs: null })
      valueSets(next)
    },

    rebetAndDeal() {
      const { game } = get()
      if (game.phase !== 'showdown') return
      const next = pg.rebet(game)
      if (next === game) return refuse('Not enough in the rack to rebet')
      play('chipStack', { count: 4 })
      sync(next)
      get().deal()
    },

    toggleCard(index) {
      const { game, low } = get()
      if (game.phase !== 'setting' || index < 0 || index > 6) return
      play('card')
      const next = low.includes(index) ? low.filter((i) => i !== index) : low.length < 2 ? [...low, index] : [low[0], index]
      set({ low: next })
      watchFoul(next)
    },

    clearLow() {
      const { game, low } = get()
      if (game.phase !== 'setting' || low.length === 0) return
      play('card')
      set({ low: [] })
    },

    setHouseWay() {
      const { game } = get()
      if (game.phase !== 'setting') return
      play('card')
      set({ low: [...houseWay(pg.playerCodes(game), game.rules).set.low] })
    },

    confirmSet() {
      const { game, low } = get()
      if (game.phase !== 'setting') return
      if (low.length !== 2) return refuse('Choose two cards for the low hand')
      const next = pg.setPlayerHand(game, low)
      if (next === game) return
      play('chipStack', { count: 2 })
      set({ game: next, dealerStage: 'down', notice: null })
      reveal()
    },

    updateSettings(patch) {
      const { game, profile } = get()
      const rules: Partial<PaiGowRules> = {}
      if (patch.commissionFree !== undefined && patch.commissionFree !== game.rules.commissionFree) rules.commissionFree = patch.commissionFree
      if (patch.wheelSecond !== undefined && patch.wheelSecond !== game.rules.wheelSecond) rules.wheelSecond = patch.wheelSecond
      let keep = patch
      if (Object.keys(rules).length > 0) {
        const next = pg.setRules(game, rules)
        if (next === game) {
          // Saved only once the table takes it: a rule refused mid-hand must not come back as the table's.
          refuse('Change the house rules between hands')
          const { commissionFree: _c, wheelSecond: _w, ...rest } = patch
          keep = rest
        } else set({ game: next })
      }
      set({ profile: withSettings(profile, keep) })
      persist()
    },

    setDisplayName(name) {
      set({ profile: withName(get().profile, name) })
      persist()
    },

    rebuy() {
      timers.clear()
      const profile = restartRun(get().profile)
      set({ ...clean, profile, game: newGame(profile), evs: null })
      persist()
    },

    chooseBankroll(amount) {
      const state = get()
      if (!selectCanChoosePaiGowBankroll(state) || amount === state.profile.bankroll) return
      get().resetRack(amount)
    },

    resetRack(amount) {
      const state = get()
      if (selectPaiGowHasRun(state)) {
        set({ profile: withSettings(state.profile, { startingBankroll: amount }) })
        get().rebuy()
        return
      }
      timers.clear()
      const profile = openingStake(state.profile, amount)
      set({ ...clean, profile, game: newGame(profile), evs: null })
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
      set({ ...clean, profile, game: newGame(profile), evs: null })
      persist()
    },
  }
})

// Every change to the felt is saved, so the snapshot never trails the table.
usePaiGowStore.subscribe((state, prev) => {
  if (!state.ready) return
  if (state.game === prev.game && state.low === prev.low && state.foulSeen === prev.foulSeen && state.profile.runStartedAt === prev.profile.runStartedAt) return
  felt.save(state.profile.runStartedAt, { game: state.game, low: state.low, foulSeen: state.foulSeen })
})

export const selectCanChoosePaiGowBankroll = (s: PaiGowStore) => s.ready && (s.game.phase === 'betting' || s.game.phase === 'showdown')
export const selectPaiGowHasRun = (s: PaiGowStore) => s.profile.stats.hands > 0

/** Chips in the circles that are still the player's to lose. */
export function paigowAtRisk(game: PaiGowState): number {
  return game.phase === 'showdown' ? 0 : pg.totalOnFelt(game)
}

/** Two sets that read the same — the same hands, whichever suits went where — are the same set. */
export function sameSet(a: Pick<SetHand, 'highScore' | 'lowScore'>, b: Pick<SetHand, 'highScore' | 'lowScore'>): boolean {
  return a.highScore === b.highScore && a.lowScore === b.lowScore
}

/** What a set gives up against the house way's, in bets (never below zero: a set the coach prefers costs nothing). */
export function evCost(evs: SetEv[], mine: SetHand, house: SetHand): number | null {
  const of = (s: SetHand) => evs.find((e) => sameLow(e.low, s.low))?.ev
  const a = of(mine)
  const b = of(house)
  if (a === undefined || b === undefined) return null
  return sameSet(mine, house) ? 0 : Math.max(0, b - a)
}

export function fortuneName(hand: FortuneHand | null): string {
  return hand ? FORTUNE_LABEL[hand] : '—'
}

let evWorker: Worker | null | undefined
let nextJob = 0
const evJobs = new Map<number, (evs: SetEv[]) => void>()

/** Every set valued in a worker so the deal never stalls; worked out in place where there are no workers (the tests). */
function workOut(job: Omit<EvJob, 'id'>): Promise<SetEv[]> {
  if (evWorker === undefined) {
    evWorker = typeof Worker === 'undefined' ? null : new Worker(new URL('../engine/paigow/evWorker.ts', import.meta.url), { type: 'module' })
    evWorker?.addEventListener('message', (event: MessageEvent<{ id: number; evs: SetEv[] }>) => {
      evJobs.get(event.data.id)?.(event.data.evs)
      evJobs.delete(event.data.id)
    })
    evWorker?.addEventListener('error', () => {
      evWorker = null
      evJobs.clear()
    })
  }
  if (!evWorker) return Promise.resolve().then(() => evaluate(job))
  const id = nextJob++
  evWorker.postMessage({ id, ...job } satisfies EvJob)
  return new Promise((resolve) => evJobs.set(id, resolve))
}
