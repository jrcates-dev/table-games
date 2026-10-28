import { create } from 'zustand'

/**
 * Interface chrome state, kept apart from the game itself.
 *
 * Which side panel is open is not game state — it must not be persisted, and it
 * has no business inside `GameState`. It lives here because several unrelated
 * places need it: the top bar's switcher, the strategy-card button that sits
 * with the play controls, and the keyboard handler.
 */
export type PanelId = 'chart' | 'stats' | 'leaderboard' | 'settings' | 'account'

interface UiStore {
  panel: PanelId | null
  openPanel(id: PanelId): void
  togglePanel(id: PanelId): void
  closePanel(): void
  /** The "Reshuffle decks?" question is on screen. */
  shuffleAsk: boolean
  askShuffle(): void
  closeShuffle(): void
}

export const useUiStore = create<UiStore>((set) => ({
  panel: null,
  openPanel: (id) => set({ panel: id }),
  togglePanel: (id) => set((s) => ({ panel: s.panel === id ? null : id })),
  closePanel: () => set({ panel: null }),
  shuffleAsk: false,
  askShuffle: () => set({ shuffleAsk: true }),
  closeShuffle: () => set({ shuffleAsk: false }),
}))
