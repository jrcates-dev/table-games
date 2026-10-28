import { usePrefs, type EffectsPref } from '../prefs/prefsStore'

/**
 * How much of the show this device gets.
 *
 * Full is everything: the dice in soft-shadowed, clear-coated acetate, the
 * foil sweeping across the sign, the chandeliers glinting. Reduced keeps every
 * picture but draws the dice more cheaply and lets the lobby's ambient lights
 * sit still, so a phone's battery and an older GPU are spared work no one is
 * looking at. Left on auto, a phone, a tablet or a modest machine gets reduced.
 */
export type EffectsLevel = 'full' | 'reduced'

export function autoEffects(): EffectsLevel {
  if (typeof window === 'undefined') return 'full'
  const touch = window.matchMedia?.('(pointer: coarse)').matches === true
  const cores = navigator.hardwareConcurrency || 8
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  return touch || cores <= 4 || memory <= 4 ? 'reduced' : 'full'
}

export function effectsLevel(pref: EffectsPref): EffectsLevel {
  return pref === 'auto' ? autoEffects() : pref
}

export function useEffectsLevel(): EffectsLevel {
  return effectsLevel(usePrefs((s) => s.effects))
}
