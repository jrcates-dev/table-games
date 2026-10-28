import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Sound starts off. These pin that down for a first visit, and for a player
 * whose preferences were saved back when it started on.
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
    expect(prefs).toEqual({ muted: true, master: 0.6, felt: 'sapphire', cardBack: 'navy', effects: 'auto', haptics: true })
  })
})
