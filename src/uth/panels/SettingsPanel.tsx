import { Field, Section, Segmented, Toggle } from '../../components/controls'
import { AppearanceSettings, SoundSettings } from '../../components/GlobalSettings'
import { SeatSettings } from '../../components/SeatSettings'
import { TRIPS_TABLES, tripsEdge, type TripsTableId } from '../../engine/uth/rules'
import { percent } from '../../lib/format'
import { useUthStore } from '../../store/uthStore'
import { useUthUi } from '../../store/tableUi'

export function UthSettingsPanel() {
  const settings = useUthStore((s) => s.profile.settings)
  const tripsTable = useUthStore((s) => s.game.tripsTable)
  const displayName = useUthStore((s) => s.profile.displayName)
  const update = useUthStore((s) => s.updateSettings)
  const setName = useUthStore((s) => s.setDisplayName)
  const rebuy = useUthStore((s) => s.rebuy)
  const reset = useUthStore((s) => s.resetEverything)
  const close = useUthUi((s) => s.closePanel)
  const ids = Object.keys(TRIPS_TABLES) as TripsTableId[]

  return (
    <div className="settings">
      <Section title="The table">
        <Field label="Trips pays" hint="The three tables you meet on the Strip differ only on the full house, flush and straight — enough to more than triple what the bet costs. Changes between hands.">
          <Segmented
            value={tripsTable}
            onChange={(next) => update({ tripsTable: next })}
            options={ids.map((id) => ({ value: id, label: `${TRIPS_TABLES[id].name.split('-').slice(3, 6).join('-')} · ${percent(tripsEdge(TRIPS_TABLES[id]), 2)}` }))}
          />
        </Field>
        <Field label="Dealing" hint="How long the dealer takes over each card.">
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
          label="Strategy coach"
          hint="Flags the book play on the buttons, says why, and on the river shows what betting and folding are each worth. Your decisions are scored against it either way."
          checked={settings.coach}
          onChange={(coach) => update({ coach })}
        />
        <Toggle
          label="House edge on every bet"
          hint="Colour-codes each wager by what the house keeps, on the rail, in the book and under the pointer."
          checked={settings.showEdges}
          onChange={(showEdges) => update({ showEdges })}
        />
      </Section>

      <SoundSettings />
      <AppearanceSettings />

      <SeatSettings
        game="Ultimate Texas Hold'em"
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
