import { afterEach, describe, expect, it, vi } from 'vitest'
import { BACCARAT_DECKS, BANKER_COMMISSION, TIE_PAYS } from '../engine/baccarat/rules'
import { CRAPS_TABLE, limitsFor } from '../engine/craps/rules'
import { TRIPS_TABLES } from '../engine/uth/rules'

/**
 * A new player finds every table dealing the game a Strip pit deals on its
 * main floor. The better and worse games stay a choice away in Settings.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

async function stores() {
  vi.resetModules()
  vi.stubGlobal('localStorage', undefined)
  const [roulette, uth, paigow] = await Promise.all([import('./rouletteStore'), import('./uthStore'), import('./paigowStore')])
  return { roulette, uth, paigow }
}

describe('the pit on a first visit', () => {
  it('craps takes 3-4-5x odds at every table', () => {
    expect(limitsFor(CRAPS_TABLE).oddsMultiple).toEqual({ 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5 })
  })

  it('baccarat deals eight decks, takes 5% on the Banker and pays the tie 8 to 1', () => {
    expect(BACCARAT_DECKS).toBe(8)
    expect(BANKER_COMMISSION).toBe(0.05)
    expect(TIE_PAYS).toBe(8)
  })

  it('roulette spins a double-zero wheel', async () => {
    const { roulette } = await stores()
    expect(roulette.DEFAULT_ROULETTE_SETTINGS.wheel).toBe('double')
  })

  it("Ultimate Texas Hold'em pays Trips on the usual 50-40-30-8-6-5-3", async () => {
    const { uth } = await stores()
    expect(TRIPS_TABLES[uth.DEFAULT_UTH_SETTINGS.tripsTable].name).toBe('50-40-30-8-6-5-3')
  })

  it('Pai Gow takes 5% of a win, with the wheel the lowest straight', async () => {
    const { paigow } = await stores()
    expect(paigow.DEFAULT_PAIGOW_SETTINGS.commissionFree).toBe(false)
    expect(paigow.DEFAULT_PAIGOW_SETTINGS.wheelSecond).toBe(false)
  })
})
