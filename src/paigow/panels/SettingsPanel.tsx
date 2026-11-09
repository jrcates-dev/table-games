import { Section, Segmented, Field, Toggle } from '../../components/controls'
import { AppearanceSettings, SoundSettings } from '../../components/GlobalSettings'
import { SeatSettings } from '../../components/SeatSettings'
import { PAIGOW_EDGE, PAIGOW_EDGE_NO_COMMISSION } from '../../engine/paigow/rules'
import { percent } from '../../lib/format'
import { usePaiGowStore } from '../../store/paigowStore'
import { usePaiGowUi } from '../../store/tableUi'

export function PaiGowSettingsPanel() {
  const settings = usePaiGowStore((s) => s.profile.settings)
  const rules = usePaiGowStore((s) => s.game.rules)
  const displayName = usePaiGowStore((s) => s.profile.displayName)
  const update = usePaiGowStore((s) => s.updateSettings)
  const setName = usePaiGowStore((s) => s.setDisplayName)
  const rebuy = usePaiGowStore((s) => s.rebuy)
  const reset = usePaiGowStore((s) => s.resetEverything)
  const close = usePaiGowUi((s) => s.closePanel)

  return (
    <div className="settings">
      <Section title="The table">
        <Field label="Commission" hint="Aria's tables take 5% of a win. A commission-free table pays even money instead, but pushes any win over a dealer's queen-high pai gow. Changes between hands.">
          <Segmented
            value={rules.commissionFree ? 'free' : 'five'}
            onChange={(next) => update({ commissionFree: next === 'free' })}
            options={[
              { value: 'five', label: `5% · ${percent(PAIGOW_EDGE, 2)}` },
              { value: 'free', label: `None · ${percent(PAIGOW_EDGE_NO_COMMISSION, 2)}` },
            ]}
          />
        </Field>
        <Toggle
          label="Wheel is the second-best straight"
          hint="A-2-3-4-5 ranks just under A-K-Q-J-10, as some older rooms still play it. Off, it is the lowest straight. Changes between hands."
          checked={rules.wheelSecond}
          onChange={(wheelSecond) => update({ wheelSecond })}
        />
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
          label="House way coach"
          hint="Marks the house way on your cards, names it, and says what your set is worth against it. Your sets are scored against it either way."
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
        game="Pai Gow Poker"
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
