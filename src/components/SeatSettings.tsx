import { useState } from 'react'
import { money } from '../lib/format'
import { MAX_STARTING_BANKROLL, MIN_STARTING_BANKROLL } from '../store/stake'
import { Field, MoneyInput, Section } from './controls'

/**
 * The player's own corner of a settings drawer: the name on the table, what a
 * buy-back-in is worth, and the way to start over. Every table but blackjack
 * and craps shares it word for word.
 */
export function SeatSettings({
  game,
  displayName,
  startingBankroll,
  onName,
  onStartingBankroll,
  onRebuy,
  onReset,
}: {
  /** "Baccarat", as the hint and the warning name it. */
  game: string
  displayName: string
  startingBankroll: number
  onName(name: string): void
  onStartingBankroll(amount: number): void
  onRebuy(): void
  onReset(): void
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <Section title="You">
        <Field label="Display name">
          <input className="select" style={{ backgroundImage: 'none' }} value={displayName} maxLength={24} onChange={(e) => onName(e.target.value)} />
        </Field>
        <Field
          label="Buy-in"
          hint={`What "Buy back in" hands you, between ${money(MIN_STARTING_BANKROLL)} and ${money(MAX_STARTING_BANKROLL)}. ${game} keeps its own bankroll, separate from every other table.`}
        >
          <MoneyInput value={startingBankroll} onCommit={onStartingBankroll} />
        </Field>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRebuy}>
          Buy back in · {money(startingBankroll)}
        </button>
      </Section>

      <Section title="Danger zone">
        {confirm ? (
          <div className="confirm">
            <p>This erases your {game.toLowerCase()} bankroll, statistics and history.</p>
            <div className="confirm__buttons">
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  onReset()
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
            Reset {game.toLowerCase()} profile
          </button>
        )}
      </Section>
    </>
  )
}
