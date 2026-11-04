import { ChipImage } from '../components/Chip'
import { DENOMINATIONS, chipBreakdown } from '../components/chips'
import { ChipStack } from '../components/ChipStack'
import { CardBackFace, CardFace } from '../components/PlayingCard'
import type { ReactNode } from 'react'
import * as Art from '../components/gameIcons'
import type { Rank, Suit } from '../engine/types'

const ICONS: Array<[string, (p: { width?: number; height?: number }) => ReactNode, string]> = [
  ['Hit', Art.ArtHit, '#6ff0b8'],
  ['Stand', Art.ArtStand, '#ff9ca1'],
  ['Double', Art.ArtDouble, '#e3c170'],
  ['Split', Art.ArtSplit, '#9fc2ff'],
  ['Surrender', Art.ArtSurrender, '#c9c4d8'],
  ['Insure', Art.ArtInsure, '#e3c170'],
  ['No thanks', Art.ArtDecline, '#ff9ca1'],
  ['Deal', Art.ArtDeal, '#2a1d06'],
  ['Roll', Art.ArtRoll, '#2a1d06'],
  ['Spin', Art.ArtSpin, '#2a1d06'],
  ['Clear', Art.ArtClear, '#f4ead6'],
  ['Undo', Art.ArtUndo, '#f4ead6'],
  ['Rebet', Art.ArtRebet, '#f4ead6'],
  ['Odds', Art.ArtOdds, '#f4ead6'],
  ['Buy in', Art.ArtBuyIn, '#2a1d06'],
  ['New bet', Art.ArtNewBet, '#f4ead6'],
  ['Check', Art.ArtCheck, '#9fc2ff'],
  ['Bet 4x', (p) => <Art.ArtBet multiple={4} {...p} />, '#e3c170'],
  ['Bet 3x', (p) => <Art.ArtBet multiple={3} {...p} />, '#e3c170'],
  ['Bet 2x', (p) => <Art.ArtBet multiple={2} {...p} />, '#e3c170'],
  ['Bet 1x', (p) => <Art.ArtBet multiple={1} {...p} />, '#e3c170'],
  ['Fold', Art.ArtFold, '#ff9ca1'],
]

/** Every picture a button carries, big enough to judge the drawing and at the sizes it is used: ?gallery=icons. */
function IconSheet() {
  return (
    <div className="gallery-icons" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 24 }}>
      {ICONS.map(([name, Icon, color]) => (
        <div key={name} style={{ width: 132, padding: 10, borderRadius: 14, background: '#151112', color, textAlign: 'center', border: '1px solid #ffffff22' }}>
          <Icon width={112} height={112} />
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <Icon width={32} height={32} />
            <Icon width={22} height={22} />
            <Icon width={18} height={18} />
          </div>
          <div style={{ fontSize: 11, marginTop: 4 }}>{name}</div>
        </div>
      ))}
    </div>
  )
}

/** Development-only sheet of every card and chip, for checking the artwork. */
export function Gallery() {
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  const suits: Suit[] = ['S', 'H', 'D', 'C']
  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto', background: '#0f5e3f' }}>
      {new URLSearchParams(window.location.search).get('gallery') === 'icons' && <IconSheet />}
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
