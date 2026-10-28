import { create } from 'zustand'
import { play } from '../audio'
import { startHold } from '../lib/touch'

/**
 * What a spot's hover card says, and the store that says which spot the
 * pointer is over. Kept apart from the card itself so a table can hand its
 * spots pointer handlers without importing the component.
 */

export interface TipContent {
  title: string
  pays: string
  wins?: string
  loses?: string
  /** House edge on this bet. Left out when the player has edges turned off. */
  edge?: number
  /** Where the edge figure comes from, if it is not the textbook number. */
  edgeNote?: string
  /**
   * The same bet priced from what is left in the shoe. Shown under the edge,
   * smaller, because a player at a real table cannot see into the shoe.
   */
  shoeEdge?: number
  /** What the shoe figure is worked out from, such as how many cards are left. */
  shoeNote?: string
  /** What a click does. */
  hint?: string
  /** Why a click would be refused. */
  reason?: string
}

interface TipStore {
  id: string | null
  x: number
  y: number
  /** Opened by a long press: it stays up after the finger lifts, until the next tap. */
  pinned: boolean
  /** Offered on a pinned card, a finger's right-click: take the bet there down. */
  takeDown: (() => void) | null
  show(id: string, x: number, y: number): void
  pin(id: string, x: number, y: number, takeDown?: () => void): void
  move(x: number, y: number): void
  hide(id: string): void
}

/** Outside React's render path, so moving the pointer re-renders the card and nothing else. */
export const useTip = create<TipStore>((set, get) => ({
  id: null,
  x: 0,
  y: 0,
  pinned: false,
  takeDown: null,
  show: (id, x, y) => set({ id, x, y, pinned: false, takeDown: null }),
  pin: (id, x, y, takeDown) => set({ id, x, y, pinned: true, takeDown: takeDown ?? null }),
  move: (x, y) => set({ x, y }),
  hide: (id) => {
    if (get().id === id) set({ id: null, pinned: false, takeDown: null })
  },
}))

let frame = 0

/**
 * Pointer handlers for one spot. A mouse shows the card by resting on the
 * spot; a finger by pressing and holding it (see lib/touch). `takeDown`, given
 * when there is a bet on the spot to take back, goes on a held card as a button.
 */
export function tipHandlers(id: string, allowed = true, takeDown?: () => void) {
  return {
    onPointerEnter: (event: React.PointerEvent) => {
      if (event.pointerType === 'touch') return
      useTip.getState().show(id, event.clientX, event.clientY)
      if (allowed) play('hover')
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (event.pointerType === 'touch') return
      const { clientX, clientY } = event
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => useTip.getState().move(clientX, clientY))
    },
    onPointerLeave: (event: React.PointerEvent) => {
      if (event.pointerType !== 'touch') useTip.getState().hide(id)
    },
    onPointerDown: (event: React.PointerEvent) =>
      startHold(event, (x, y) => {
        useTip.getState().pin(id, x, y, allowed ? takeDown : undefined)
        return () => useTip.getState().hide(id)
      }),
  }
}

/**
 * A card's hint is written for a mouse; held open by a finger it says what a
 * finger does instead, and leaves taking the bet down to the button.
 */
export function forFinger(hint: string): string {
  return hint.replace(/ · right-click takes (it back|down)/i, '').replace(/\bclick\b/g, 'tap')
}
