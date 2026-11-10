import { create } from 'zustand'
import { isTouchDevice } from '../lib/device'

/**
 * Preferences that belong to the player rather than to any one game.
 *
 * Volume, the colour of the felt and the design on the back of the cards are
 * the same choice at every table, so they live here once instead of being
 * agreed on separately by six profiles. Game-specific settings — the coach,
 * the count, roll speed — stay with their games.
 */
export type FeltTheme = 'emerald' | 'sapphire' | 'crimson' | 'violet' | 'onyx'
export type CardBack = 'crimson' | 'navy' | 'emerald' | 'onyx'
/** How much of the show to put on: decided by the device, or the player's call. */
export type EffectsPref = 'auto' | 'full' | 'reduced'

export interface Prefs {
  /** The table's sound. Off until the player turns it on. */
  muted: boolean
  master: number
  felt: FeltTheme
  cardBack: CardBack
  effects: EffectsPref
  /** A tap of vibration as chips land and dice settle, where the phone can. Off until the player turns it on. */
  haptics: boolean
}

export const DEFAULT_PREFS: Prefs = {
  muted: true,
  master: 0.8,
  felt: 'crimson',
  cardBack: 'crimson',
  effects: 'auto',
  haptics: false,
}

const PREF_KEYS = Object.keys(DEFAULT_PREFS) as Array<keyof Prefs>

/**
 * What a first visit starts with on this device. A phone or a tablet starts on
 * the lighter effects, chosen outright rather than left to auto, so Settings
 * shows what it is getting.
 */
export function defaultPrefs(): Prefs {
  return { ...DEFAULT_PREFS, effects: isTouchDevice() ? 'reduced' : DEFAULT_PREFS.effects }
}

export const FELT_THEMES: Array<{ id: FeltTheme; name: string; swatch: string }> = [
  { id: 'emerald', name: 'Emerald', swatch: '#0f5e3f' },
  { id: 'sapphire', name: 'Sapphire', swatch: '#143f72' },
  { id: 'crimson', name: 'Crimson', swatch: '#6a1424' },
  { id: 'violet', name: 'Amethyst', swatch: '#3c2266' },
  { id: 'onyx', name: 'Onyx', swatch: '#1f232d' },
]

export const CARD_BACKS: Array<{ id: CardBack; name: string; swatch: string }> = [
  { id: 'crimson', name: 'Crimson', swatch: '#7c1428' },
  { id: 'navy', name: 'Midnight', swatch: '#14244a' },
  { id: 'emerald', name: 'Jade', swatch: '#0d4a36' },
  { id: 'onyx', name: 'Onyx', swatch: '#15151b' },
]

const KEY = 'arena:prefs:v2'

/**
 * Saved before sound started off, when every profile recorded it as on. The
 * felt, card backs and volume carry over; the sound itself starts off.
 */
const LEGACY_KEY = 'arena:prefs:v1'

function load(): Prefs {
  const defaults = defaultPrefs()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<Prefs>) }
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (!legacy) return defaults
    const old = JSON.parse(legacy) as Partial<Prefs>
    return {
      ...defaults,
      master: old.master ?? defaults.master,
      felt: old.felt ?? defaults.felt,
      cardBack: old.cardBack ?? defaults.cardBack,
    }
  } catch {
    return defaults
  }
}

/** Just the preference fields, without the store's methods. */
function pick(source: Prefs): Prefs {
  const out = {} as Record<keyof Prefs, unknown>
  for (const key of PREF_KEYS) out[key] = source[key]
  return out as Prefs
}

function save(prefs: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Preferences are a convenience; a blocked store costs the player their
    // volume setting on reload and nothing else.
  }
}

interface PrefsStore extends Prefs {
  set(patch: Partial<Prefs>): void
  toggleMute(): void
}

export const usePrefs = create<PrefsStore>((set, get) => ({
  ...load(),
  set(patch) {
    set(patch)
    save(pick(get()))
  },
  toggleMute() {
    get().set({ muted: !get().muted })
  },
}))

export function currentPrefs(): Prefs {
  return pick(usePrefs.getState())
}
