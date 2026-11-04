import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * What a first visit starts with: the sound off, crimson felt, no vibration,
 * and on a phone or a tablet the lighter effects. These pin that down, and
 * that a player's saved choices, old or new, are kept.
 */

function storage(entries: Record<string, string>): Storage {
  const data = new Map(Object.entries(entries))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

/** A window whose main pointer is a finger, or a mouse. */
function device(touch: boolean) {
  vi.stubGlobal('window', { matchMedia: (query: string) => ({ matches: touch && query === '(pointer: coarse)' }) })
}

async function loadWith(entries: Record<string, string>) {
  vi.resetModules()
  vi.stubGlobal('localStorage', storage(entries))
  const { currentPrefs } = await import('./prefsStore')
  return currentPrefs()
}

describe('preferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts with the sound off', async () => {
    const prefs = await loadWith({})
    expect(prefs.muted).toBe(true)
  })

  it('starts on the crimson felt with vibration off', async () => {
    const prefs = await loadWith({})
    expect(prefs.felt).toBe('crimson')
    expect(prefs.haptics).toBe(false)
  })

  it('starts a phone or a tablet on the lighter effects', async () => {
    device(true)
    const prefs = await loadWith({})
    expect(prefs.effects).toBe('reduced')
  })

  it('leaves a computer on auto', async () => {
    device(false)
    const prefs = await loadWith({})
    expect(prefs.effects).toBe('auto')
  })

  it('keeps what a player already chose, even on a phone', async () => {
    device(true)
    const prefs = await loadWith({
      'arena:prefs:v2': JSON.stringify({ muted: true, master: 0.8, felt: 'emerald', cardBack: 'navy', effects: 'full', haptics: true }),
    })
    expect(prefs).toEqual({ muted: true, master: 0.8, felt: 'emerald', cardBack: 'navy', effects: 'full', haptics: true })
  })

  it('keeps a saved choice to have the sound on', async () => {
    const prefs = await loadWith({ 'arena:prefs:v2': JSON.stringify({ muted: false, master: 0.5 }) })
    expect(prefs.muted).toBe(false)
    expect(prefs.master).toBe(0.5)
  })

  it('carries old preferences over but starts their sound off', async () => {
    const prefs = await loadWith({
      'arena:prefs:v1': JSON.stringify({
        muted: false,
        master: 0.6,
        sfx: 0.85,
        music: 0.4,
        musicEnabled: true,
        felt: 'sapphire',
        cardBack: 'navy',
      }),
    })
    expect(prefs).toEqual({ muted: true, master: 0.6, felt: 'sapphire', cardBack: 'navy', effects: 'auto', haptics: false })
  })
})
