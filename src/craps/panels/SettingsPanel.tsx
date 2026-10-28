import { useState } from 'react'
import { Field, MoneyInput, Section, Segmented, Toggle } from '../../components/controls'
import { AppearanceSettings, SoundSettings } from '../../components/GlobalSettings'
import { money } from '../../lib/format'
import { useCrapsStore } from '../../store/crapsStore'
import { useCrapsUiStore } from '../../store/crapsUiStore'
import { MAX_STARTING_BANKROLL, MIN_STARTING_BANKROLL } from '../../store/stake'

export function CrapsSettingsPanel() {
  const settings = useCrapsStore((s) => s.profile.settings)
  const displayName = useCrapsStore((s) => s.profile.displayName)
  const update = useCrapsStore((s) => s.updateSettings)
  const setName = useCrapsStore((s) => s.setDisplayName)
  const rebuy = useCrapsStore((s) => s.rebuy)
  const reset = useCrapsStore((s) => s.resetEverything)
  const close = useCrapsUiStore((s) => s.closePanel)
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="settings">
      <Section title="The table">
        <Field label="Throw" hint="Instant skips the tumble for anyone playing for the numbers rather than the theatre.">
          <Segmented
            value={settings.rollSpeed}
            onChange={(rollSpeed) => update({ rollSpeed })}
            options={[
              { value: 'relaxed', label: 'Relaxed' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
              { value: 'instant', label: 'Instant' },
            ]}
          />
        </Field>
      </Section>

      <Section title="Table talk">
        <Toggle
          label="House edge on every bet"
          hint="Colour-codes each wager by what the house keeps — the fastest way to learn which half of the layout to avoid."
          checked={settings.showEdges}
          onChange={(showEdges) => update({ showEdges })}
        />
        <Toggle
          label="What the next roll would do"
          hint="Runs all eleven possible totals against the bets you have up."
          checked={settings.showProjection}
          onChange={(showProjection) => update({ showProjection })}
        />
      </Section>

      <SoundSettings />
      <AppearanceSettings />

      <Section title="You">
        <Field label="Display name">
          <input className="select" style={{ backgroundImage: 'none' }} value={displayName} maxLength={24} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label="Buy-in"
          hint={`What "Buy back in" hands you, between ${money(MIN_STARTING_BANKROLL)} and ${money(MAX_STARTING_BANKROLL)}. Craps keeps its own bankroll, separate from blackjack.`}
        >
          <MoneyInput value={settings.startingBankroll} onCommit={(startingBankroll) => update({ startingBankroll })} />
        </Field>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            rebuy()
            close()
          }}
        >
          Buy back in · {money(settings.startingBankroll)}
        </button>
      </Section>

      <Section title="Danger zone">
        {confirm ? (
          <div className="confirm">
            <p>This erases your craps bankroll, statistics and every recorded shoot.</p>
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
            Reset craps profile
          </button>
        )}
      </Section>
    </div>
  )
}
