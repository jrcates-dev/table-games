import { Field, Section, Segmented, Toggle } from '../../components/controls'
import { AppearanceSettings, SoundSettings } from '../../components/GlobalSettings'
import { SeatSettings } from '../../components/SeatSettings'
import { useBaccaratStore } from '../../store/baccaratStore'
import { useBaccaratUi } from '../../store/tableUi'

export function BaccaratSettingsPanel() {
  const settings = useBaccaratStore((s) => s.profile.settings)
  const displayName = useBaccaratStore((s) => s.profile.displayName)
  const update = useBaccaratStore((s) => s.updateSettings)
  const setName = useBaccaratStore((s) => s.setDisplayName)
  const rebuy = useBaccaratStore((s) => s.rebuy)
  const reset = useBaccaratStore((s) => s.resetEverything)
  const close = useBaccaratUi((s) => s.closePanel)

  return (
    <div className="settings">
      <Section title="The table">
        <Field label="Dealing" hint="How long the dealer takes over each card as the coup is turned.">
          <Segmented
            value={settings.dealSpeed}
            onChange={(dealSpeed) => update({ dealSpeed })}
            options={[
              { value: 'relaxed', label: 'Relaxed' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
            ]}
          />
        </Field>
      </Section>

      <Section title="Table talk">
        <Toggle
          label="House edge on every bet"
          hint="Colour-codes each wager by what the house keeps, on the rail, in the book and under the pointer."
          checked={settings.showEdges}
          onChange={(showEdges) => update({ showEdges })}
        />
        <Toggle
          label="Price bets from this shoe"
          hint="Works every edge out again from the cards still in the shoe after each coup. Off, every figure is the fresh-shoe number."
          checked={settings.liveOdds}
          onChange={(liveOdds) => update({ liveOdds })}
        />
      </Section>

      <SoundSettings />
      <AppearanceSettings />

      <SeatSettings
        game="Baccarat"
        displayName={displayName}
        startingBankroll={settings.startingBankroll}
        onName={setName}
        onStartingBankroll={(startingBankroll) => update({ startingBankroll })}
        onRebuy={() => {
          rebuy()
          close()
        }}
        onReset={reset}
      />
    </div>
  )
}
