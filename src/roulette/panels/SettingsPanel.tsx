import { Field, Section, Segmented, Toggle } from '../../components/controls'
import { AppearanceSettings, SoundSettings } from '../../components/GlobalSettings'
import { SeatSettings } from '../../components/SeatSettings'
import { ROULETTE_LIMITS, WHEEL_ROOM } from '../../engine/roulette/rules'
import { money } from '../../lib/format'
import { useRouletteStore } from '../../store/rouletteStore'
import { useRouletteUi } from '../../store/tableUi'

export function RouletteSettingsPanel() {
  const settings = useRouletteStore((s) => s.profile.settings)
  const wheel = useRouletteStore((s) => s.game.wheel)
  const spinning = useRouletteStore((s) => s.game.phase === 'spinning')
  const displayName = useRouletteStore((s) => s.profile.displayName)
  const update = useRouletteStore((s) => s.updateSettings)
  const setWheel = useRouletteStore((s) => s.setWheel)
  const setName = useRouletteStore((s) => s.setDisplayName)
  const rebuy = useRouletteStore((s) => s.rebuy)
  const reset = useRouletteStore((s) => s.resetEverything)
  const close = useRouletteUi((s) => s.closePanel)
  const limits = ROULETTE_LIMITS[wheel]

  return (
    <div className="settings">
      <Section title="The table">
        <Field
          label="Wheel"
          hint={`${WHEEL_ROOM[wheel]}: ${money(limits.tableMin)} minimum, ${money(limits.maxStraight)} a number, ${money(limits.maxOutside)} outside. Changing wheels returns your chips and starts the history afresh.`}
        >
          <Segmented
            value={wheel}
            onChange={(next) => !spinning && setWheel(next)}
            options={[
              { value: 'double', label: 'Double zero · 5.26%' },
              { value: 'single', label: 'Single zero · 2.70%' },
            ]}
          />
        </Field>
        <Field label="Spin" hint="How long the ball runs before it drops.">
          <Segmented
            value={settings.spinSpeed}
            onChange={(spinSpeed) => update({ spinSpeed })}
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
      </Section>

      <SoundSettings />
      <AppearanceSettings />

      <SeatSettings
        game="Roulette"
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
