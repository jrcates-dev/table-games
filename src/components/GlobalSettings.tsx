import { autoEffects } from '../lib/effects'
import { canVibrate } from '../lib/haptics'
import { CARD_BACKS, FELT_THEMES, usePrefs, type EffectsPref } from '../prefs/prefsStore'
import { Field, Section, Segmented, Slider, Swatches, Toggle } from './controls'

/**
 * Sound and appearance, shared by both tables' settings drawers — they are the
 * player's preferences, not either game's.
 */
export function SoundSettings() {
  const prefs = usePrefs()

  return (
    <Section title="Sound">
      <Toggle
        label="Table sounds"
        hint="Chips, cards and dice, nothing else. M turns them on and off anywhere."
        checked={!prefs.muted}
        onChange={(on) => prefs.set({ muted: !on })}
      />
      <Slider label="Volume" value={prefs.master} onChange={(master) => prefs.set({ master })} disabled={prefs.muted} />
      {canVibrate() && (
        <Toggle
          label="Vibration"
          hint="A tap as chips land and the dice settle."
          checked={prefs.haptics}
          onChange={(haptics) => prefs.set({ haptics })}
        />
      )}
    </Section>
  )
}

const EFFECTS: Array<{ value: EffectsPref; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Lighter' },
]

export function AppearanceSettings() {
  const felt = usePrefs((s) => s.felt)
  const cardBack = usePrefs((s) => s.cardBack)
  const effects = usePrefs((s) => s.effects)
  const set = usePrefs((s) => s.set)
  return (
    <Section title="Table">
      <div className="field">
        <span className="field__label">Felt</span>
        <Swatches value={felt} options={FELT_THEMES} onChange={(next) => set({ felt: next })} />
      </div>
      <div className="field">
        <span className="field__label">Card backs</span>
        <Swatches value={cardBack} options={CARD_BACKS} onChange={(next) => set({ cardBack: next })} />
      </div>
      <Field
        label="Effects"
        hint={`Lighter keeps every picture but plays it simpler: a few sparkles for a win, quicker banners and screen changes, plainer dice and still lobby lights. For a phone, an older computer or a longer battery. Auto ${
          autoEffects() === 'reduced' ? 'picks Lighter on this device' : 'picks Full on this device'
        }.`}
      >
        <Segmented value={effects} options={EFFECTS} onChange={(next) => set({ effects: next })} />
      </Field>
    </Section>
  )
}
