import { useState } from 'react'
import { Field, MoneyInput, Section, Segmented, Toggle } from '../../components/controls'
import { AppearanceSettings, SoundSettings } from '../../components/GlobalSettings'
import { RULE_PRESETS } from '../../engine/rules'
import { money } from '../../lib/format'
import { useGameStore } from '../../store/gameStore'
import { MAX_STARTING_BANKROLL, MIN_STARTING_BANKROLL } from '../../store/stake'
import { ruleLines } from '../rulesText'

export function SettingsPanel() {
  const settings = useGameStore((s) => s.profile.settings)
  const displayName = useGameStore((s) => s.profile.displayName)
  const update = useGameStore((s) => s.updateSettings)
  const setName = useGameStore((s) => s.setDisplayName)
  const reset = useGameStore((s) => s.resetEverything)
  const phase = useGameStore((s) => s.game.round.phase)
  const rules = useGameStore((s) => s.game.rules)
  const [confirm, setConfirm] = useState(false)
  // Between hands, including while the last one is still on the felt: a
  // change clears it away and starts a fresh shoe (see updateSettings).
  const betweenHands = phase === 'betting' || phase === 'roundOver'

  return (
    <div className="settings">
      <Section title="The table">
        <Field label="House rules" hint={betweenHands ? ruleLines(rules).join(' · ') : 'Changes apply between hands.'}>
          <select
            className="select"
            value={settings.rulePreset}
            disabled={!betweenHands}
            onChange={(event) => update({ rulePreset: event.target.value })}
          >
            {Object.entries(RULE_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Deal speed">
          <Segmented
            value={settings.dealSpeed}
            onChange={(dealSpeed) => update({ dealSpeed })}
            options={[
              { value: 'relaxed', label: 'Relaxed' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
              { value: 'instant', label: 'Instant' },
            ]}
          />
        </Field>
        <Toggle
          label="Offer insurance"
          hint="Asks when the dealer shows an ace. Off, insurance is always declined, which is the book's play unless the true count is +3 or better."
          checked={settings.offerInsurance}
          onChange={(offerInsurance) => update({ offerInsurance })}
        />
      </Section>

      <Section title="Assistance">
        <Toggle
          label="Basic strategy coach"
          hint="Marks the mathematically correct play on the controls."
          checked={settings.showCoach}
          onChange={(showCoach) => update({ showCoach })}
        />
        <Toggle
          label="Confirm deviations"
          hint="Holds a play that departs from the book so you can reconsider it."
          checked={settings.coachStrict}
          onChange={(coachStrict) => update({ coachStrict })}
          disabled={!settings.showCoach}
        />
        <Toggle
          label="Card counting"
          hint="Hi-Lo running and true count, decks left and a bet-spread suggestion."
          checked={settings.showCount}
          onChange={(showCount) => update({ showCount })}
        />
        <Toggle label="Hand totals" checked={settings.showTotals} onChange={(showTotals) => update({ showTotals })} />
      </Section>

      <SoundSettings />
      <AppearanceSettings />

      <Section title="You">
        <Field label="Display name">
          <input className="select" style={{ backgroundImage: 'none' }} value={displayName} maxLength={24} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label="Buy-in"
          hint={`What "Buy back in" hands you and a reset starts you on, between ${money(MIN_STARTING_BANKROLL)} and ${money(MAX_STARTING_BANKROLL)}. Your current rack is untouched.`}
        >
          <MoneyInput value={settings.startingBankroll} onCommit={(startingBankroll) => update({ startingBankroll })} />
        </Field>
      </Section>

      <Section title="Danger zone">
        {confirm ? (
          <div className="confirm">
            <p>This erases your blackjack bankroll, statistics and every recorded hand.</p>
            <div className="confirm__buttons">
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  reset()
                  setConfirm(false)
                }}
              >
                Erase everything
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(true)}>
            Reset blackjack profile
          </button>
        )}
      </Section>
    </div>
  )
}
