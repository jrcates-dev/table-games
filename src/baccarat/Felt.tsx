import { memo } from 'react'
import { DTable, FeltText } from '../components/DTable'
import { arcPath } from '../components/tableArc'
import { Monogram } from '../components/TopBar'
import { BOX, HAND, SPOTS, bandTextArc, shapePath, type BetSpot } from './geometry'

/**
 * The printing on a mini-baccarat felt: the two card boxes on the dealer's
 * side, the bands and circles of the apron on yours, and the rule every
 * baccarat table carries in gold.
 */
export const BaccaratFelt = memo(function BaccaratFelt() {
  return (
    <DTable
      id="ba"
      defs={
        <>
          {SPOTS.filter((s) => s.shape.type === 'band').map((s) => (
            <path key={s.kind} id={`ba-arc-${s.kind}`} d={bandTextArc(s.shape as Extract<BetSpot['shape'], { type: 'band' }>, 9)} />
          ))}
          <path id="ba-arc-rule" d={arcPath(992, 992, 13)} />
        </>
      }
    >
      <g className="ba-print">
        <CardBox side="player" />
        <CardBox side="banker" />
        {SPOTS.map((spot) => (
          <Spot key={spot.kind} spot={spot} />
        ))}
        <text fontFamily="Cinzel, serif" fontWeight="600" fontSize="13" letterSpacing="3" fill="var(--felt-print)" opacity="0.62">
          <textPath href="#ba-arc-rule" startOffset="50%" textAnchor="middle">
            BANKER PAYS 5% COMMISSION
          </textPath>
        </text>
        <g transform={`translate(${750 - 20} ${398}) scale(0.63)`} opacity="0.22">
          <Monogram size={64} />
        </g>
      </g>
    </DTable>
  )
})

function CardBox({ side }: { side: 'player' | 'banker' }) {
  const { x } = HAND[side]
  const h = BOX.bottom - BOX.top
  return (
    <g>
      <rect x={x - BOX.w / 2} y={BOX.top} width={BOX.w} height={h} rx="18" fill="#000" opacity="0.1" />
      <rect x={x - BOX.w / 2} y={BOX.top} width={BOX.w} height={h} rx="18" fill="none" stroke="url(#gold-foil)" strokeWidth="2.2" opacity="0.85" />
      <rect x={x - BOX.w / 2 + 8} y={BOX.top + 8} width={BOX.w - 16} height={h - 16} rx="12" fill="none" stroke="#e3c170" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 5" />
      <FeltText x={x} y={BOX.top + h / 2 + 14} size={40} spacing={10} opacity={0.2} gold>
        {side === 'player' ? 'PLAYER' : 'BANKER'}
      </FeltText>
    </g>
  )
}

function Spot({ spot }: { spot: BetSpot }) {
  const { shape } = spot
  const d = shapePath(shape)
  if (shape.type === 'band') {
    return (
      <g>
        <path d={d} fill="#000" opacity={spot.kind === 'banker' ? 0.14 : 0.1} />
        <path d={d} fill="none" stroke="url(#gold-foil)" strokeWidth="2.6" />
        <text fontFamily="Cinzel, serif" fontWeight="700" fontSize="27" letterSpacing="12" fill="url(#gold-foil)">
          <textPath href={`#ba-arc-${spot.kind}`} startOffset="50%" textAnchor="middle">
            {spot.label}
          </textPath>
        </text>
        <text fontFamily="Cinzel, serif" fontWeight="600" fontSize="12" letterSpacing="3.5" fill="var(--felt-print)" opacity="0.72" dy="20">
          <textPath href={`#ba-arc-${spot.kind}`} startOffset="50%" textAnchor="middle">
            {spot.sub}
          </textPath>
        </text>
      </g>
    )
  }
  const cx = shape.cx
  const cy = shape.cy
  return (
    <g>
      <path d={d} fill="#000" opacity="0.12" />
      <path d={d} fill="none" stroke="url(#gold-foil)" strokeWidth="2.2" />
      <FeltText x={cx} y={cy - 2} size={spot.kind === 'tie' ? 22 : 13} spacing={spot.kind === 'tie' ? 6 : 2} gold>
        {spot.label}
      </FeltText>
      <FeltText x={cx} y={cy + 17} size={12} spacing={1.2} weight={600} opacity={0.75}>
        {spot.sub}
      </FeltText>
    </g>
  )
}
