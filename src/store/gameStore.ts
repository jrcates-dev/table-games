import { useMemo } from 'react'
import { create } from 'zustand'
import { play } from '../audio'
import * as bj from '../engine/blackjack'
import { countSnapshot } from '../engine/counting'
import { formatTotal } from '../engine/hand'
import { DEFAULT_RULE_PRESET, RULE_PRESETS, STARTING_BANKROLL, tableById } from '../engine/rules'
import { randomSeed } from '../engine/rng'
import { basicStrategy } from '../engine/strategy'
import type { Card, GameState, PlayerAction, PlayerHand, TableTier } from '../engine/types'
import {
  createProfile,
  MAX_HISTORY,
  type HandRecord,
  type Profile,
  type RecordedCard,
  type Settings,
  type StrategyMistake,
} from './profile'
import { clampStartingBankroll } from './stake'
import { LocalStorageAdapter, type LeaderboardEntry, type StorageAdapter } from './storage'
import { resolveAdapter, supabaseConfigured } from './supabase'

/** Milliseconds between dealt cards, by comfort setting. */
export const DEAL_INTERVAL: Record<Settings['dealSpeed'], number> = {
  relaxed: 520,
  normal: 330,
  fast: 190,
  // Barely an animation: the cards are on the felt before you have finished
  // clicking. For anyone grinding hands rather than watching them.
  instant: 55,
}

/**
 * Seconds a card spends in the air, by the same setting.
 *
 * This has to scale alongside the interval or "instant" does not feel instant:
 * dealing four cards 55ms apart while each one still takes 420ms to fly in
 * means the last card lands nearly half a second after the deal is logically
 * over. The stagger is only half of what you actually see.
 */
export const CARD_FLIGHT: Record<Settings['dealSpeed'], number> = {
  relaxed: 0.5,
  normal: 0.42,
  fast: 0.3,
  instant: 0.09,
}

/**
 * A win worth the fanfare: several times what was put out at the start of the
 * hand, however large the table minimum — and never less than ten minimums.
 */
export function isBigWin(hands: readonly PlayerHand[], net: number, minBet: number): boolean {
  const opening = hands.reduce((sum, h) => sum + (h.doubled ? h.bet / 2 : h.bet), 0) / Math.max(1, hands.length)
  return net >= Math.max(opening * 2.5, minBet * 10)
}

/** A pending coach interception the player must confirm or correct. */
export interface CoachChallenge {
  attempted: PlayerAction
  correct: PlayerAction
  reason: string
}

interface GameStore {
  game: GameState
  profile: Profile
  adapter: StorageAdapter
  ready: boolean
  /** True while cards are in flight or the dealer is drawing. */
  animating: boolean
  challenge: CoachChallenge | null
  leaderboard: LeaderboardEntry[]
  /** Set for a moment after settlement so the felt can flash the result. */
  lastNet: number | null
  cloudAvailable: boolean

  init(): Promise<void>
  table(): TableTier
  addChip(amount: number): void
  removeChip(amount: number): void
  doubleBet(): void
  clearBet(): void
  maxBet(): void
  dealRound(): void
  act(action: PlayerAction, force?: boolean): void
  dismissChallenge(): void
  nextRound(): void
  /** Retire the shoe early and start a fresh one; the count resets with it. */
  shuffleUp(): void
  rebuy(): void
  /** Choose the opening rack from the lobby, before the first hand is dealt. */
  chooseBankroll(amount: number): void
  /** Set the rack to this amount whatever is in play, closing a played run first. */
  resetRack(amount: number): void
  /**
   * Move the rack to the figure the floor shares, leaving whatever is in play
   * where it is. Saved only when asked: while the bankroll is shared, the floor
   * keeps the figure.
   */
  matchRack(amount: number, save?: boolean): void
  selectTable(id: string): void
  updateSettings(patch: Partial<Settings>): void
  setDisplayName(name: string): void
  refreshLeaderboard(): Promise<void>
  resetEverything(): void
}

let initialising: Promise<void> | null = null

/** Timers are module-level so a hot reload cannot orphan them. */
let timers: ReturnType<typeof setTimeout>[] = []
function schedule(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

function record(card: Card): RecordedCard {
  return { rank: card.rank, suit: card.suit }
}

function rulesFor(profile: Profile) {
  return (RULE_PRESETS[profile.settings.rulePreset] ?? RULE_PRESETS[DEFAULT_RULE_PRESET]).rules
}

export const useGameStore = create<GameStore>((set, get) => {
  /** Persist without blocking the table. */
  const persist = () => {
    const { adapter, profile } = get()
    void adapter.save(profile)
  }

  const interval = () => DEAL_INTERVAL[get().profile.settings.dealSpeed]
  /** Seconds from a card leaving the shoe to the sound of it landing. */
  const landing = () => Math.max(0, CARD_FLIGHT[get().profile.settings.dealSpeed] - 0.08)

  /**
   * Fold a finished round into the profile: stats, history, peak bankroll, and
   * the result flash.
   */
  const settleRound = () => {
    const { game, profile } = get()
    const net = game.bankroll - roundStartBankroll
    const stats = { ...profile.stats }

    for (const hand of game.round.hands) {
      stats.handsPlayed += 1
      stats.totalWagered += hand.bet
      if (hand.doubled) stats.doubles += 1
      if (hand.fromSplit) stats.splits += 1
      switch (hand.outcome) {
        case 'blackjack':
          stats.blackjacks += 1
          stats.handsWon += 1
          break
        case 'win':
          stats.handsWon += 1
          break
        case 'push':
          stats.handsPushed += 1
          break
        case 'bust':
          stats.busts += 1
          stats.handsLost += 1
          break
        case 'surrender':
          stats.surrenders += 1
          stats.handsLost += 1
          break
        default:
          stats.handsLost += 1
      }
    }

    if (game.round.insuranceBet > 0) {
      stats.insuranceTaken += 1
      stats.totalWagered += game.round.insuranceBet
    }

    stats.roundsPlayed += 1
    stats.netResult += net
    stats.biggestWin = Math.max(stats.biggestWin, net)
    stats.biggestLoss = Math.min(stats.biggestLoss, net)
    if (net > 0) {
      stats.currentStreak = stats.currentStreak > 0 ? stats.currentStreak + 1 : 1
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak)
    } else if (net < 0) {
      stats.currentStreak = stats.currentStreak < 0 ? stats.currentStreak - 1 : -1
    }

    const entry: HandRecord = {
      id: `${Date.now()}-${stats.roundsPlayed}`,
      timestamp: Date.now(),
      tableId: profile.tableId,
      dealer: game.round.dealer.map(record),
      hands: game.round.hands.map((hand) => ({
        cards: hand.cards.map(record),
        bet: hand.bet,
        outcome: hand.outcome ?? 'lose',
        doubled: hand.doubled,
        fromSplit: hand.fromSplit,
      })),
      insuranceBet: game.round.insuranceBet,
      net,
      bankrollAfter: game.bankroll,
      trueCount: Number(countSnapshot(game).true.toFixed(1)),
      mistakes: pendingMistakes.slice(),
    }
    pendingMistakes = []

    const peak = Math.max(profile.peakBankroll, game.bankroll)

    set({
      lastNet: net,
      animating: false,
      profile: {
        ...profile,
        bankroll: game.bankroll,
        peakBankroll: peak,
        allTimePeak: Math.max(profile.allTimePeak, peak),
        runRounds: profile.runRounds + 1,
        stats,
        history: [entry, ...profile.history].slice(0, MAX_HISTORY),
      },
    })

    persist()
  }

  /** Draw the dealer's cards one at a time, then settle. */
  const runDealer = () => {
    const step = () => {
      const state = get().game
      if (state.round.phase !== 'dealerTurn') return
      if (!bj.dealerHasMoreToDraw(state)) {
        set({ game: bj.settle(state) })
        settleRound()
        return
      }
      set({ game: bj.dealerStep(state) })
      play('card', { at: landing() })
      schedule(step, interval())
    }
    // A beat before the dealer acts, so the reveal has room to land.
    schedule(step, interval() * 1.6)
  }

  /** Advance automatically whenever the engine hands control back to us. */
  const drive = () => {
    const phase = get().game.round.phase
    if (phase === 'dealerTurn') {
      set({ animating: true })
      runDealer()
    } else if (phase === 'roundOver') {
      settleRound()
    } else {
      set({ animating: false })
    }
  }

  let pendingMistakes: StrategyMistake[] = []
  /** The rack as the hand in play was dealt, which its result is measured against. */
  let roundStartBankroll = 0

  return {
    game: bj.createGame(rulesFor(createProfile(STARTING_BANKROLL)), STARTING_BANKROLL, randomSeed()),
    profile: createProfile(STARTING_BANKROLL),
    adapter: new LocalStorageAdapter(),
    ready: false,
    animating: false,
    challenge: null,
    leaderboard: [],
    lastNet: null,
    cloudAvailable: supabaseConfigured,

    async init() {
      // Once per page. Walking back to the table from the lobby must find the
      // hand exactly where it was left, not a fresh shoe.
      initialising ??= (async () => {
        const adapter = await resolveAdapter()
        const stored = await adapter.load()
        const profile = stored ?? createProfile(STARTING_BANKROLL)
        // The circle opens empty. Every round after this one carries the
        // previous wager forward, but the first wager of a session is the
        // player's to make.
        set({
          adapter,
          profile,
          ready: true,
          game: bj.createGame(rulesFor(profile), profile.bankroll, randomSeed()),
        })
        void get().refreshLeaderboard()
      })()
      return initialising
    },

    table() {
      return tableById(get().profile.tableId)
    },

    addChip(amount) {
      const { game } = get()
      if (game.round.phase !== 'betting') return
      const table = get().table()
      const next = Math.min(game.pendingBet + amount, table.maxBet, game.bankroll)
      if (next === game.pendingBet) return
      play('chip')
      set({ game: bj.setBet(game, next), lastNet: null })
    },

    /** Take one chip of this value back off the circle. */
    removeChip(amount) {
      const { game } = get()
      if (game.round.phase !== 'betting' || game.pendingBet === 0) return
      play('chip', { strength: 0.5 })
      set({ game: bj.setBet(game, Math.max(0, game.pendingBet - amount)) })
    },

    /** Double the wager in the circle, within the table limit and the rack. */
    doubleBet() {
      const { game } = get()
      if (game.round.phase !== 'betting' || game.pendingBet === 0) return
      const table = get().table()
      const next = Math.min(game.pendingBet * 2, table.maxBet, game.bankroll)
      if (next === game.pendingBet) return
      play('chipStack', { count: 4 })
      set({ game: bj.setBet(game, next), lastNet: null })
    },

    clearBet() {
      // From a settled hand, clear the felt first and leave the circle empty.
      if (get().game.round.phase === 'roundOver') get().nextRound()
      const { game } = get()
      if (game.round.phase !== 'betting') return
      if (game.pendingBet > 0) play('chipSlide')
      set({ game: bj.setBet(game, 0) })
    },

    maxBet() {
      const { game } = get()
      if (game.round.phase !== 'betting') return
      const table = get().table()
      play('chip')
      set({ game: bj.setBet(game, Math.min(table.maxBet, game.bankroll)) })
    },

    dealRound() {
      const { game } = get()
      const table = get().table()
      if (game.round.phase !== 'betting') return
      if (game.pendingBet < table.minBet || game.pendingBet > game.bankroll) return

      clearTimers()
      pendingMistakes = []
      roundStartBankroll = game.bankroll

      const dealt = bj.deal(game)
      set({ game: dealt, animating: true, lastNet: null, challenge: null })

      // Stagger the click of each card landing.
      // Each snap is timed to the card landing, not leaving the shoe.
      for (let i = 0; i < 4; i++) play('card', { at: (i * interval()) / 1000 + landing() })

      schedule(() => {
        let next = bj.finishDealing(get().game)
        // A player who has asked never to be offered insurance is answered for,
        // with the book's answer at any count short of +3.
        if (next.round.phase === 'insurance' && !get().profile.settings.offerInsurance) {
          next = bj.declineInsurance(next)
        }
        set({ game: next })
        drive()
      }, 4 * interval() + 120)
    },

    act(action, force = false) {
      const { game, profile } = get()
      if (get().animating && game.round.phase !== 'playerTurn' && game.round.phase !== 'insurance') {
        return
      }

      const legal = bj.availableActions(game)
      if (!legal.includes(action)) return

      // Grade the decision against basic strategy before executing it.
      if (game.round.phase === 'playerTurn') {
        const hand = game.round.hands[game.round.activeHandIndex]
        const correct = basicStrategy(hand, game.round.dealer[0], { rules: game.rules, legal })
        const stats = { ...profile.stats, strategyTotal: profile.stats.strategyTotal + 1 }

        if (action === correct) {
          stats.strategyCorrect += 1
        } else {
          pendingMistakes.push({
            played: action,
            correct,
            playerTotal: formatTotal(hand.cards),
            dealerUpcard: game.round.dealer[0].rank,
          })
          if (profile.settings.coachStrict && !force) {
            set({
              challenge: {
                attempted: action,
                correct,
                reason: `${formatTotal(hand.cards)} against a dealer ${game.round.dealer[0].rank}`,
              },
            })
            // Rewind the graded attempt; it is re-graded when the player commits.
            pendingMistakes.pop()
            return
          }
        }
        set({ profile: { ...profile, stats } })
      }

      play('click')
      set({ challenge: null })

      const apply: Record<PlayerAction, (s: GameState) => GameState> = {
        hit: bj.hit,
        stand: bj.stand,
        double: bj.double,
        split: bj.split,
        surrender: bj.surrender,
        insurance: bj.takeInsurance,
        declineInsurance: bj.declineInsurance,
      }

      const next = apply[action](game)
      // A card physically arrives on hit, double and split.
      if (next.round.seq > game.round.seq) play('card', { at: landing() })
      set({ game: next })
      drive()
    },

    dismissChallenge() {
      set({ challenge: null })
    },

    nextRound() {
      clearTimers()
      const { game, profile } = get()
      if (game.round.phase !== 'roundOver') return
      const table = tableById(profile.tableId)
      let next = bj.nextRound({ ...game, bankroll: profile.bankroll })
      // The cut card was reached during the last round; the shoe is now fresh
      // and the running count has reset to zero.
      if (next.shoe.shuffleCount !== game.shoe.shuffleCount) play('shuffle')
      // Carry the previous wager forward, but never below the table minimum or
      // above what is left in the rack.
      const carried = Math.max(table.minBet, Math.min(next.pendingBet, profile.bankroll))
      next = bj.setBet(next, profile.bankroll >= table.minBet ? carried : 0)
      set({ game: next, lastNet: null, challenge: null, animating: false })
    },

    shuffleUp() {
      const before = get().game.shoe.shuffleCount
      // Clear the last hand off the felt first, as a dealer would.
      if (get().game.round.phase === 'roundOver') get().nextRound()
      const { game, animating } = get()
      if (game.round.phase !== 'betting' || animating) return
      // The cut card may already have forced a fresh shoe on the way.
      if (game.shoe.shuffleCount !== before) return
      play('shuffle')
      set({ game: bj.shuffleUp(game) })
    },

    rebuy() {
      const { profile, adapter } = get()
      // Archive the finished run so the leaderboard keeps an honest record of
      // how high this bankroll actually got before it went to zero.
      const run = {
        id: `${profile.runStartedAt}`,
        startedAt: profile.runStartedAt,
        endedAt: Date.now(),
        peakBankroll: profile.peakBankroll,
        roundsPlayed: profile.runRounds,
      }
      void adapter.submitRun(profile)

      // Whatever the player said they wanted to sit down with, not what the
      // house hands out.
      const stake = clampStartingBankroll(profile.settings.startingBankroll)
      const next: Profile = {
        ...profile,
        bankroll: stake,
        peakBankroll: stake,
        allTimePeak: Math.max(profile.allTimePeak, profile.peakBankroll),
        tableId: 'bronze',
        runStartedAt: Date.now(),
        runRounds: 0,
        runs: [run, ...profile.runs].slice(0, 50),
      }
      set({
        profile: next,
        game: bj.createGame(rulesFor(next), stake, randomSeed()),
        lastNet: null,
      })
      persist()
      void get().refreshLeaderboard()
    },

    chooseBankroll(amount) {
      const state = get()
      if (!selectCanChooseBankroll(state)) return
      // The lobby field commits on blur, so leaving it untouched hands back the
      // rack as it stands; that must not end a run.
      if (amount === state.profile.bankroll) return
      get().resetRack(amount)
    },

    resetRack(amount) {
      const state = get()
      const stake = clampStartingBankroll(amount)
      // Asked for and confirmed, so it does not wait for the hand to finish: a
      // hand left in play is swept off along with everything else.
      clearTimers()
      set({ animating: false, challenge: null })
      if (state.profile.stats.roundsPlayed > 0) {
        // A table that has been played has a run to account for. It closes the
        // way busting out does, archived with its peak, and the new run starts
        // with the amount chosen, which is also what later buy-backs hand out.
        set({ profile: { ...state.profile, settings: { ...state.profile.settings, startingBankroll: stake } } })
        get().rebuy()
        return
      }
      // Nothing has been played, so nothing is being rewritten: the run simply
      // starts with what the player brought. It is also what a buy-back-in
      // hands them, until they say otherwise in Settings.
      const profile: Profile = {
        ...state.profile,
        bankroll: stake,
        peakBankroll: stake,
        allTimePeak: stake,
        runStartedAt: Date.now(),
        settings: { ...state.profile.settings, startingBankroll: stake },
      }
      // Between hands the shoe stays as it is; only a first hand still being
      // played needs a fresh one.
      const game =
        state.game.round.phase === 'betting'
          ? bj.setBet({ ...state.game, bankroll: stake }, state.game.pendingBet)
          : bj.createGame(rulesFor(profile), stake, randomSeed())
      set({ profile, game })
      persist()
    },

    matchRack(amount, save = false) {
      const { game, profile } = get()
      const shift = amount - game.bankroll
      if (shift !== 0) {
        // A hand in play keeps its wager and is still measured against the rack
        // it was dealt from, moved by the same amount.
        roundStartBankroll += shift
        set({
          profile: { ...profile, bankroll: profile.bankroll + shift },
          game:
            game.round.phase === 'betting'
              ? bj.setBet({ ...game, bankroll: amount }, game.pendingBet)
              : { ...game, bankroll: amount },
        })
      }
      if (save) persist()
    },

    selectTable(id) {
      const { game, profile } = get()
      if (game.round.phase !== 'betting') return
      const table = tableById(id)
      if (profile.peakBankroll < table.requiredBankroll) return
      play('click')
      set({
        profile: { ...profile, tableId: id },
        // An empty circle stays empty; an existing wager is pulled into the new
        // table's limits.
        game: bj.setBet(
          game,
          game.pendingBet === 0
            ? 0
            : Math.min(Math.max(table.minBet, game.pendingBet), table.maxBet, game.bankroll),
        ),
      })
      persist()
    },

    updateSettings(patch) {
      const { profile, game } = get()
      const settings = { ...profile.settings, ...patch }
      // Clamped here rather than at the input, so no control can seat a player
      // with a rack the table would refuse.
      settings.startingBankroll = clampStartingBankroll(settings.startingBankroll)
      const next = { ...profile, settings }
      set({ profile: next })

      // A rule change only takes effect between rounds, and starts a fresh shoe
      // because the count would otherwise be meaningless.
      if (patch.rulePreset && patch.rulePreset !== profile.settings.rulePreset) {
        if (game.round.phase === 'betting') {
          set({ game: bj.setBet(bj.createGame(rulesFor(next), profile.bankroll, randomSeed()), game.pendingBet) })
        }
      }
      persist()
    },

    setDisplayName(name) {
      const trimmed = name.trim().slice(0, 24) || 'Guest'
      set({ profile: { ...get().profile, displayName: trimmed } })
      persist()
    },

    async refreshLeaderboard() {
      try {
        set({ leaderboard: await get().adapter.leaderboard(25) })
      } catch {
        set({ leaderboard: [] })
      }
    },

    resetEverything() {
      clearTimers()
      // Statistics, history and bankroll go; preferences are not a record of
      // anything and survive, including the stake the player chose.
      const { settings } = get().profile
      const stake = clampStartingBankroll(settings.startingBankroll)
      const profile: Profile = { ...createProfile(stake), settings: { ...settings } }
      set({
        profile,
        game: bj.createGame(rulesFor(profile), stake, randomSeed()),
        lastNet: null,
        challenge: null,
        animating: false,
      })
      persist()
    },
  }
})

/** Convenience selectors used across the UI. */
export const selectPhase = (s: GameStore) => s.game.round.phase
export const selectActions = (s: GameStore) => bj.availableActions(s.game)
/**
 * The lobby offers to set the rack whenever no hand is in play. Before the
 * first hand that is simply the opening stake; after it, choosing again closes
 * the current run and starts a new one.
 */
export const selectCanChooseBankroll = (s: GameStore) =>
  s.ready && !s.animating && (s.game.round.phase === 'betting' || s.game.round.phase === 'roundOver')
/** Whether choosing a bankroll in the lobby would end a run already played. */
export const selectBankrollHasRun = (s: GameStore) => s.profile.stats.roundsPlayed > 0
/** Between hands with nothing in flight: the only time the shoe can be swapped. */
export const selectCanShuffle = (s: GameStore) =>
  s.ready && !s.animating && (s.game.round.phase === 'betting' || s.game.round.phase === 'roundOver')

/**
 * The counting HUD derives a fresh object from the shoe on every read, which
 * would make a naive selector re-render forever. Subscribing to the game state
 * and deriving in a hook keeps the reference stable between shoe changes.
 */
export function useCount() {
  const game = useGameStore((s) => s.game)
  return useMemo(() => countSnapshot(game), [game])
}
