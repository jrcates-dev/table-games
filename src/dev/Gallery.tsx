import { ChipImage } from '../components/Chip'
import { DENOMINATIONS, chipBreakdown } from '../components/chips'
import { ChipStack } from '../components/ChipStack'
import { CardBackFace, CardFace } from '../components/PlayingCard'
import type { Rank, Suit } from '../engine/types'

/** Development-only sheet of every card and chip, for checking the artwork. */
export function Gallery() {
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  const suits: Suit[] = ['S', 'H', 'D', 'C']
  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto', background: '#0f5e3f' }}>
      {suits.slice(0, 2).map((suit) => (
        <div key={suit} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {ranks.map((rank) => (
            <div key={rank} style={{ width: 110, height: 154, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.4))' }}>
              <CardFace rank={rank} suit={suit} />
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['D', 'C'] as Suit[]).flatMap((suit) =>
          (['A', 'K', 'Q', 'J', '10'] as Rank[]).map((rank) => (
            <div key={suit + rank} style={{ width: 110, height: 154 }}>
              <CardFace rank={rank} suit={suit} />
            </div>
          )),
        )}
        {(['crimson', 'navy', 'emerald', 'onyx'] as const).map((t) => (
          <div key={t} style={{ width: 110, height: 154 }}>
            <CardBackFace theme={t} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 30 }}>
        {DENOMINATIONS.map((d) => (
          <ChipImage key={d.value} denom={d} size={72} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 70, alignItems: 'flex-end', paddingLeft: 40, height: 160 }}>
        {[5, 25, 125, 480, 1275, 2350, 7500, 36].map((amount, i) => (
          <div key={amount} style={{ position: 'relative', width: 0, height: 0 }}>
            <ChipStack amount={amount} size={64} tilt={34} seed={i + 1} billboard={false} />
          </div>
        ))}
        <div style={{ position: 'relative', width: 0, height: 0, marginLeft: 60 }}>
          <ChipStack chips={chipBreakdown(900)} size={64} tilt={34} seed={3} billboard={false} perColumn={6} />
        </div>
      </div>
    </div>
  )
}
