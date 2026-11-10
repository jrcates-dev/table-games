import { create } from 'zustand'

/**
 * Where on the floor you are standing.
 *
 * Deliberately the only thing the games share. Statistics, histories and
 * leaderboards are separate all the way down, and so are bankrolls unless the
 * player chooses to carry one between tables (see `racks.ts`) — walking from
 * one pit to the other should feel like changing games, not like carrying one
 * game's baggage into another.
 */
export type GameId = 'blackjack' | 'craps' | 'baccarat' | 'roulette' | 'uth' | 'paigow'
export type Screen = 'lobby' | GameId

export interface GameMeta {
  id: GameId
  name: string
}

export const GAMES: GameMeta[] = [
  { id: 'blackjack', name: 'Blackjack' },
  { id: 'craps', name: 'Craps' },
  { id: 'baccarat', name: 'Baccarat' },
  { id: 'roulette', name: 'Roulette' },
  { id: 'uth', name: "Ultimate Texas Hold'em" },
  { id: 'paigow', name: 'Pai Gow Poker' },
]

const KEY = 'cta:game:v1'

function storedGame(): GameId | null {
  try {
    const value = localStorage.getItem(KEY)
    return GAMES.some((g) => g.id === value) ? (value as GameId) : null
  } catch {
    return null
  }
}

interface AppStore {
  screen: Screen
  /** The table you were last at, which the lobby offers to take you back to; none on a first visit. */
  lastGame: GameId | null
  go(screen: Screen): void
}

export const useAppStore = create<AppStore>((set) => ({
  // Every visit starts in the lobby: it is the first thing a player touches,
  // which is also the gesture the browser needs before it will play sound.
  screen: 'lobby',
  lastGame: storedGame(),
  go(screen) {
    if (screen !== 'lobby') {
      try {
        localStorage.setItem(KEY, screen)
      } catch {
        // A blocked store costs the player their "continue" and nothing else.
      }
      set({ screen, lastGame: screen })
    } else {
      set({ screen })
    }
  },
}))

export function gameMeta(id: GameId): GameMeta {
  return GAMES.find((g) => g.id === id) ?? GAMES[0]
}
