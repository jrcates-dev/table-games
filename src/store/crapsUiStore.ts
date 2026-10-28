import { create } from 'zustand'
import { railStartsFolded } from '../lib/compact'

/**
 * Craps interface chrome, kept apart from the blackjack equivalent for the same
 * reason the games' profiles are: the two have different panels, and pretending
 * otherwise would mean a union type that neither side fully satisfies.
 */
export type CrapsPanelId = 'reference' | 'stats' | 'settings'

const RAIL_KEY = 'arena:craps:rail'

/** As the player last left it; until then open, unless it would cover the felt. */
function storedRail(): boolean {
  try {
    const stored = localStorage.getItem(RAIL_KEY)
    return stored ? stored === 'open' : !railStartsFolded()
  } catch {
    return !railStartsFolded()
  }
}

interface CrapsUiStore {
  panel: CrapsPanelId | null
  /** The bet rail down the right-hand side. */
  railOpen: boolean
  togglePanel(id: CrapsPanelId): void
  closePanel(): void
  toggleRail(): void
}

export const useCrapsUiStore = create<CrapsUiStore>((set, get) => ({
  panel: null,
  railOpen: storedRail(),
  togglePanel: (id) => set((s) => ({ panel: s.panel === id ? null : id })),
  closePanel: () => set({ panel: null }),
  toggleRail: () => {
    const railOpen = !get().railOpen
    try {
      localStorage.setItem(RAIL_KEY, railOpen ? 'open' : 'closed')
    } catch {
      // Remembering the rail is a nicety, never a requirement.
    }
    set({ railOpen })
  },
}))
