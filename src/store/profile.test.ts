import { describe, expect, it } from 'vitest'
import { createProfile, DEFAULT_SETTINGS, migrateSettings } from './profile'

/**
 * A new player's first hand comes with the book: the coach marks the correct
 * play on the controls, but lets any other play through without holding it.
 */
describe('the coach on a first visit', () => {
  it('marks the book play from the first hand, without holding deviations', () => {
    const { settings } = createProfile(1000)
    expect(settings.showCoach).toBe(true)
    expect(settings.coachStrict).toBe(false)
  })

  it('stays off for a player who had already turned it off', () => {
    expect(migrateSettings({ ...DEFAULT_SETTINGS, showCoach: false }).showCoach).toBe(false)
  })
})
