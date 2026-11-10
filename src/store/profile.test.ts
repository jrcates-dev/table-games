import { describe, expect, it } from 'vitest'
import { RULE_PRESETS } from '../engine/rules'
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

/**
 * A new player sits down at the game most of the Strip deals: six decks, 6:5.
 * A player who already has a table keeps it.
 */
describe('the house rules on a first visit', () => {
  it('start on the six-deck 6:5 shoe', () => {
    const { settings } = createProfile(1000)
    expect(settings.rulePreset).toBe('ariaSixFive')
    const { rules } = RULE_PRESETS[settings.rulePreset]
    expect(rules.decks).toBe(6)
    expect(rules.blackjackPayout).toBe(1.2)
  })

  it('stay on the table a saved profile already has', () => {
    expect(migrateSettings({ ...DEFAULT_SETTINGS, rulePreset: 'ariaSalon' }).rulePreset).toBe('ariaSalon')
    expect(migrateSettings({ ...DEFAULT_SETTINGS, rulePreset: 'singleDeck' }).rulePreset).toBe('singleDeck')
  })

  it('move a profile from before the Aria tables to the 3:2 shoe that replaced its default, not to 6:5', () => {
    expect(migrateSettings({ rulePreset: 'vegasStrip' }).rulePreset).toBe('ariaSalon')
  })
})
