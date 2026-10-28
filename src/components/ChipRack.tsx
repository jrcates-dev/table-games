import { play } from '../audio'
import { money } from '../lib/format'
import { RackChip } from './ChipStack'
import type { Denomination } from './chips'

/**
 * The chip in hand, picked from the rack. At every table but blackjack the
 * layout is where a bet is made — you click the spot — so the rack only says
 * what the next click puts down.
 */
export function ChipRack({
  denominations,
  chip,
  bankroll,
  onSelect,
  size = 52,
}: {
  denominations: Denomination[]
  chip: number
  bankroll: number
  onSelect(value: number): void
  size?: number
}) {
  return (
    <div className="rack" role="radiogroup" aria-label="Chip in hand">
      {denominations.map((denom, i) => (
        <button
          key={denom.value}
          type="button"
          role="radio"
          aria-checked={denom.value === chip}
          className={`rack__chip${denom.value === chip ? ' is-selected' : ''}`}
          onClick={() => onSelect(denom.value)}
          disabled={denom.value > bankroll}
          onPointerEnter={() => play('hover')}
          title={`${money(denom.value)} chip · key ${i + 1}`}
        >
          <RackChip denom={denom} size={size} />
          <kbd>{i + 1}</kbd>
        </button>
      ))}
    </div>
  )
}
