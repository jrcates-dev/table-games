import { useEffect, useState } from 'react'
import { Field, MoneyInput, Section, Segmented, Toggle } from '../../components/controls'
import { AppearanceSettings, SoundSettings } from '../../components/GlobalSettings'
import { RULE_PRESETS } from '../../engine/rules'
import { money } from '../../lib/format'
import { useGameStore } from '../../store/gameStore'
import { MAX_STARTING_BANKROLL, MIN_STARTING_BANKROLL } from '../../store/stake'
import { getSupabase } from '../../store/supabase'
import { ruleLines } from '../rulesText'

export function SettingsPanel() {
  const settings = useGameStore((s) => s.profile.settings)
  const displayName = useGameStore((s) => s.profile.displayName)
  const update = useGameStore((s) => s.updateSettings)
  const setName = useGameStore((s) => s.setDisplayName)
  const reset = useGameStore((s) => s.resetEverything)
  const phase = useGameStore((s) => s.game.round.phase)
  const rules = useGameStore((s) => s.game.rules)
  const cloud = useGameStore((s) => s.cloudAvailable)
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="settings">
      <Section title="The table">
        <Field label="House rules" hint={phase === 'betting' ? ruleLines(rules).join(' · ') : 'Changes apply between hands.'}>
          <select
            className="select"
            value={settings.rulePreset}
            disabled={phase !== 'betting'}
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
        {cloud && <Account />}
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

/**
 * Guest by default; an account only adds cloud saves and a place on the
 * global board. Shown only when Supabase is configured.
 */
function Account() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [signedInAs, setSignedInAs] = useState<string | null>(null)

  useEffect(() => {
    void getSupabase().then((db) => db?.auth.getUser().then(({ data }) => setSignedInAs(data.user?.email ?? null)))
  }, [])

  if (signedInAs) {
    return (
      <Field label="Account" hint="Your bankroll and statistics sync across devices.">
        <div className="account-row">
          <span>{signedInAs}</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={async () => {
              await (await getSupabase())?.auth.signOut()
              window.location.reload()
            }}
          >
            Sign out
          </button>
        </div>
      </Field>
    )
  }

  return (
    <form
      className="field"
      onSubmit={async (event) => {
        event.preventDefault()
        const db = await getSupabase()
        if (!db) return
        setStatus('sending')
        const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
        setStatus(error ? 'error' : 'sent')
        setMessage(error ? error.message : `Check ${email} for a sign-in link.`)
      }}
    >
      <span className="field__label">Account</span>
      <div className="account-row">
        <input className="select" style={{ backgroundImage: 'none' }} type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" className="btn btn--gold btn--sm" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send link'}
        </button>
      </div>
      {message && <span className={`field__hint ${status === 'error' ? 'tone-lose' : 'tone-win'}`}>{message}</span>}
    </form>
  )
}
