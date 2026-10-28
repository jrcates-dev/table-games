import { create } from 'zustand'
import { closeOnNextTap, lastPressWasTouch } from '../lib/touch'
import type { TipContent } from './tip'

/**
 * Which bet a finger meant.
 *
 * Drawn whole on a phone, a roulette number is narrower than a fingertip and
 * the split, the street and the corner around it are a few pixels off, so a
 * tap that lands near a line could be any of them. Rather than guess, the
 * table asks: a small card lists the bets under the finger, the one it
 * touched first, and offers to zoom in. A tap clear of every line, and every
 * click from a mouse, bets at once as before.
 */

export interface PickOption {
  id: string
  title: string
  pays: string
}

/** What a spot is, as the game stands now; null where it cannot be bet. */
export type Describe = (id: string) => { title: string; pays: string } | null

/** A spot's hover card, as a choice: none where the card says the bet would be refused. */
export function fromTip(tip: TipContent | null): ReturnType<Describe> {
  return tip && !tip.reason ? { title: tip.title, pays: tip.pays } : null
}

interface PickStore {
  x: number
  y: number
  options: PickOption[]
  choose: ((id: string) => void) | null
  open(x: number, y: number, options: PickOption[], choose: (id: string) => void): void
  close(): void
}

let release: (() => void) | null = null

export const usePick = create<PickStore>((set) => ({
  x: 0,
  y: 0,
  options: [],
  choose: null,
  open: (x, y, options, choose) => {
    set({ x, y, options, choose })
    release = closeOnNextTap(() => set({ options: [], choose: null }))
  },
  close: () => {
    release?.()
    release = null
    set({ options: [], choose: null })
  },
}))

/** How far round a tap to look, in screen pixels: about how far a fingertip lands from where its owner aimed. */
const REACH = 5
const RING = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)])
/** More than this and the card is a list to read, not a choice: zoom in instead. */
const MOST = 5

/** The spots a tap here could have meant, the one it landed on first. */
export function spotsNear(x: number, y: number, hit: string): string[] {
  const found = [hit]
  for (const [dx, dy] of RING) {
    for (const el of document.elementsFromPoint(x + dx * REACH, y + dy * REACH)) {
      const id = el instanceof SVGElement || el instanceof HTMLElement ? el.dataset.spot : undefined
      if (id === undefined) continue
      if (!found.includes(id)) found.push(id)
      break
    }
  }
  return found
}

/** A spot's click: bet there, unless a finger landed where it could have meant another. */
export function pickOrPlace(event: React.MouseEvent, id: string, place: (id: string) => void, describe: Describe) {
  if (!lastPressWasTouch() || (event.clientX === 0 && event.clientY === 0)) return place(id)
  const options: PickOption[] = []
  for (const near of spotsNear(event.clientX, event.clientY, id)) {
    const info = describe(near)
    // Two pieces of one bet, like the pass line round its corner, are one choice.
    if (info && !options.some((o) => o.title === info.title)) options.push({ id: near, ...info })
  }
  if (options.length < 2) return place(id)
  usePick.getState().open(event.clientX, event.clientY, options.slice(0, MOST), place)
}
