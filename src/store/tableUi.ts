import { create } from 'zustand'
import { railStartsFolded } from '../lib/compact'

/**
 * Interface chrome for one of the newer tables: which drawer is open, and
 * whether the bet rail is folded away. Never persisted except the rail, which
 * a player who has folded it once does not want to fold again.
 */
export interface TableUi<P extends string> {
  panel: P | null
  railOpen: boolean
  togglePanel(id: P): void
  closePanel(): void
  toggleRail(): void
}

export function createTableUi<P extends string>(game: string) {
  const key = `arena:${game}:rail`
  // As the player last left it; until then open, unless it would cover the felt.
  const stored = () => {
    try {
      const value = localStorage.getItem(key)
      return value ? value === 'open' : !railStartsFolded()
    } catch {
      return !railStartsFolded()
    }
  }
  return create<TableUi<P>>((set, get) => ({
    panel: null,
    railOpen: stored(),
    togglePanel: (id) => set((s) => ({ panel: s.panel === id ? null : id })),
    closePanel: () => set({ panel: null }),
    toggleRail: () => {
      const railOpen = !get().railOpen
      try {
        localStorage.setItem(key, railOpen ? 'open' : 'closed')
      } catch {
        // Remembering the rail is a nicety, never a requirement.
      }
      set({ railOpen })
    },
  }))
}

export type TablePanel = 'reference' | 'stats' | 'settings'

export const useBaccaratUi = createTableUi<TablePanel>('baccarat')
export const useRouletteUi = createTableUi<TablePanel>('roulette')
export const useUthUi = createTableUi<TablePanel>('uth')
