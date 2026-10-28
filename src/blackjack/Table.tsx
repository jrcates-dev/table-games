import { memo, useMemo } from 'react'
import { Box3D } from '../components/Box3D'
import { ChipTube } from '../components/ChipTube'
import { denomination } from '../components/chips'
import { Soft } from '../components/Soft'
import { CardBackFace } from '../components/PlayingCard'
import { Monogram } from '../components/TopBar'
import type { RuleSet } from '../engine/types'
import { useEffectsLevel } from '../lib/effects'
import { noiseDataUrl } from '../lib/noise'
import type { CardBack } from '../prefs/prefsStore'
import { CARD, CIRCLE, DISCARD, FELT, PLANE, SHOE, TABLE, TRAY } from './geometry'
import { dealerRuleText, payoutWords } from './rulesText'

const { cx, edgeY } = TABLE

/** An arc of the printing, concentric-ish with the rail but flatter. */
const ARC_CY = -230
function arcPath(rx: number, ry: number, spread = 52): string {
  const a = (spread * Math.PI) / 180
  const x0 = cx - rx * Math.sin(a)
  const x1 = cx + rx * Math.sin(a)
  const y = ARC_CY + ry * Math.cos(a)
  return `M ${x0.toFixed(1)} ${y.toFixed(1)} A ${rx} ${ry} 0 0 0 ${x1.toFixed(1)} ${y.toFixed(1)}`
}

const FELT_PATH = `M ${cx - FELT.rx} ${edgeY} A ${FELT.rx} ${FELT.ry} 0 0 0 ${cx + FELT.rx} ${edgeY} Z`
const RAIL_PATH = [
  `M ${cx - TABLE.rx} ${edgeY}`,
  `A ${TABLE.rx} ${TABLE.ry} 0 0 0 ${cx + TABLE.rx} ${edgeY}`,
  `L ${cx + FELT.rx} ${edgeY}`,
  `A ${FELT.rx} ${FELT.ry} 0 0 1 ${cx - FELT.rx} ${edgeY}`,
  'Z',
].join(' ')
const WOOD = { rx: TABLE.rx + 12, ry: TABLE.ry + 12 }
const WOOD_PATH = [
  `M ${cx - WOOD.rx} ${edgeY - 14}`,
  `L ${cx + WOOD.rx} ${edgeY - 14}`,
  `L ${cx + WOOD.rx} ${edgeY}`,
  `A ${WOOD.rx} ${WOOD.ry} 0 0 1 ${cx - WOOD.rx} ${edgeY}`,
  'Z',
].join(' ')
const ellipseArc = (rx: number, ry: number) => `M ${cx - rx} ${edgeY} A ${rx} ${ry} 0 0 0 ${cx + rx} ${edgeY}`

const TRAY_COLUMNS = [5000, 1000, 500, 100, 100, 25, 25, 25, 5, 5]
/** No tray is ever full to the brim in every tube. */
const TRAY_FILL = [0.7, 0.85, 0.9, 1, 0.95, 1, 1, 0.85, 1, 0.92]

export const BlackjackTable = memo(function BlackjackTable({ rules }: { rules: RuleSet }) {
  const noise = useMemo(() => noiseDataUrl(), [])
  const railScale = TABLE.rx / TABLE.ry
  // Lighter effects lay the felt's grain and light on unblended, and leave the
  // grain off the dark wood and leather, where blended it barely shows (see Soft).
  const light = useEffectsLevel() === 'reduced'

  return (
    <svg className="bj-table" width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`} aria-hidden="true">
      <defs>
        <radialGradient id="bj-felt" gradientUnits="userSpaceOnUse" cx={cx} cy={330} r={760}>
          <stop offset="0" style={{ stopColor: 'var(--felt-hi)' }} />
          <stop offset="0.42" style={{ stopColor: 'var(--felt-mid)' }} />
          <stop offset="0.8" style={{ stopColor: 'var(--felt-lo)' }} />
          <stop offset="1" style={{ stopColor: 'var(--felt-edge)' }} />
        </radialGradient>
        <radialGradient id="bj-spot" gradientUnits="userSpaceOnUse" cx={cx} cy={360} r={520}>
          <stop offset="0" stopColor="#fff2d0" stopOpacity="0.24" />
          <stop offset="0.55" stopColor="#fff2d0" stopOpacity="0.07" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id="bj-rail"
          gradientUnits="userSpaceOnUse"
          cx={cx}
          cy={edgeY}
          r={TABLE.ry}
          gradientTransform={`translate(${cx} ${edgeY}) scale(${railScale} 1) translate(${-cx} ${-edgeY})`}
        >
          {/* A padded leather roll: tucked dark at the felt, a soft highlight
              where it rounds over toward the pendant, falling to shadow outside. */}
          <stop offset="0.9" stopColor="#0a0708" />
          <stop offset="0.921" stopColor="#120c0d" />
          <stop offset="0.932" stopColor="#2e2225" />
          <stop offset="0.945" stopColor="#5f4b4f" />
          <stop offset="0.956" stopColor="#3d2e31" />
          <stop offset="0.974" stopColor="#1c1416" />
          <stop offset="0.992" stopColor="#0c0809" />
          <stop offset="1" stopColor="#040203" />
        </radialGradient>
        <linearGradient id="bj-wood" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#2a160c" />
          <stop offset="0.3" stopColor="#5a3319" />
          <stop offset="0.5" stopColor="#3b2011" />
          <stop offset="0.72" stopColor="#62391c" />
          <stop offset="1" stopColor="#2a160c" />
        </linearGradient>
        <pattern id="bj-noise" width="256" height="256" patternUnits="userSpaceOnUse">
          <image href={noise} width="256" height="256" />
        </pattern>
        <clipPath id="bj-felt-clip">
          <path d={FELT_PATH} />
        </clipPath>
        <filter id="bj-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="bj-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="30" />
        </filter>
        <path id="bj-arc-payout" d={arcPath(820, 606, 36)} />
        <path id="bj-arc-rule" d={arcPath(856, 642, 34)} />
        <path id="bj-arc-ins" d={arcPath(876, 676, 28)} />
      </defs>

      {/* The table itself, which a phone leaves out: there the felt runs to
          every edge of the screen behind the printing (see .room__felt). */}
      <g className="table-body">
        {/* The table's shadow on the carpet. */}
        <Soft blur={30} filter="url(#bj-shadow)">
          <ellipse cx={cx} cy={edgeY + 360} rx={WOOD.rx + 30} ry={WOOD.ry * 0.62} fill="#000" opacity="0.7" />
        </Soft>

        {/* Walnut edge, padded rail, stitching. */}
        <path d={WOOD_PATH} fill="url(#bj-wood)" />
        {!light && <path d={WOOD_PATH} fill="url(#bj-noise)" opacity="0.18" style={{ mixBlendMode: 'overlay' }} />}
        <path d={RAIL_PATH} fill="url(#bj-rail)" />
        {!light && <path d={RAIL_PATH} fill="url(#bj-noise)" opacity="0.22" style={{ mixBlendMode: 'overlay' }} />}
        <path d={ellipseArc(TABLE.rx - 9, TABLE.ry - 9)} fill="none" stroke="#b58e5e" strokeOpacity="0.4" strokeWidth="1.3" strokeDasharray="6 5" />
        <path d={ellipseArc(FELT.rx + 9, FELT.ry + 9)} fill="none" stroke="#b58e5e" strokeOpacity="0.3" strokeWidth="1.1" strokeDasharray="6 5" />

        {/* Felt, its grain, the light from the pendant, and the dark where the rail overhangs. */}
        <path d={FELT_PATH} fill="url(#bj-felt)" />
        <g clipPath="url(#bj-felt-clip)">
          <rect width={PLANE.w} height={PLANE.h} fill="url(#bj-noise)" opacity="0.16" style={light ? undefined : { mixBlendMode: 'overlay' }} />
          <ellipse cx={cx} cy={360} rx={700} ry={470} fill="url(#bj-spot)" style={light ? undefined : { mixBlendMode: 'screen' }} />
          <Soft blur={16} filter="url(#bj-soft)">
            <path d={ellipseArc(FELT.rx, FELT.ry)} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="46" />
          </Soft>
          <Soft blur={16} filter="url(#bj-soft)">
            <rect x={cx - FELT.rx} y={edgeY - 30} width={FELT.rx * 2} height={46} fill="#000" opacity="0.45" />
          </Soft>
        </g>
        <path d={ellipseArc(FELT.rx - 1, FELT.ry - 1)} fill="none" stroke="url(#gold-foil)" strokeWidth="3.2" />
        <path d={ellipseArc(FELT.rx - 10, FELT.ry - 10)} fill="none" stroke="#e3c170" strokeOpacity="0.35" strokeWidth="1" />
        <line x1={cx - FELT.rx} y1={edgeY + 1} x2={cx + FELT.rx} y2={edgeY + 1} stroke="url(#gold-foil)" strokeWidth="3" />
      </g>

      {/* Printing */}
      <g className="bj-print">
        <text className="bj-print__payout" fontFamily="Cinzel, serif" fontWeight="700" fontSize="36" letterSpacing="8" fill="url(#gold-foil)">
          <textPath href="#bj-arc-payout" startOffset="50%" textAnchor="middle">
            {`BLACKJACK PAYS ${payoutWords(rules.blackjackPayout).toUpperCase()}`}
          </textPath>
        </text>
        <text fontFamily="Cinzel, serif" fontWeight="600" fontSize="16.5" letterSpacing="4.5" fill="var(--felt-print)" opacity="0.72">
          <textPath href="#bj-arc-rule" startOffset="50%" textAnchor="middle">
            {dealerRuleText(rules).toUpperCase()}
          </textPath>
        </text>
        <path d={arcPath(892, 694, 29)} fill="none" stroke="#e3c170" strokeOpacity="0.55" strokeWidth="1.6" />
        <path d={arcPath(862, 660, 29)} fill="none" stroke="#e3c170" strokeOpacity="0.55" strokeWidth="1.6" />
        <text fontFamily="Cinzel, serif" fontWeight="700" fontSize="17" letterSpacing="7" fill="var(--felt-print)" opacity="0.8" dy="6">
          <textPath href="#bj-arc-ins" startOffset="50%" textAnchor="middle">
            INSURANCE PAYS 2 TO 1
          </textPath>
        </text>
      </g>

      {/* The betting circle */}
      <g className="bj-circle">
        <circle cx={CIRCLE.x} cy={CIRCLE.y} r={CIRCLE.r + 10} fill="#000" opacity="0.12" />
        <circle cx={CIRCLE.x} cy={CIRCLE.y} r={CIRCLE.r} fill="none" stroke="url(#gold-foil)" strokeWidth="3" />
        <circle cx={CIRCLE.x} cy={CIRCLE.y} r={CIRCLE.r - 8} fill="none" stroke="#e3c170" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 5" />
        <g transform={`translate(${CIRCLE.x - 22} ${CIRCLE.y - 22}) scale(0.69)`} opacity="0.28">
          <Monogram size={64} />
        </g>
      </g>

      <DealerTray />
    </svg>
  )
})

function DealerTray() {
  const x0 = TRAY.x - TRAY.w / 2
  const y0 = TRAY.y - TRAY.h / 2
  const colW = 38
  const gap = (TRAY.w - 18 - TRAY_COLUMNS.length * colW) / (TRAY_COLUMNS.length - 1)
  return (
    <g className="bj-tray">
      <rect x={x0 - 6} y={y0 - 6} width={TRAY.w + 12} height={TRAY.h + 12} rx="10" fill="#050407" opacity="0.55" />
      <rect x={x0} y={y0} width={TRAY.w} height={TRAY.h} rx="7" fill="#15141a" stroke="url(#gold-foil)" strokeWidth="1.6" />
      {TRAY_COLUMNS.map((value, i) => (
        <ChipTube
          key={i}
          x={x0 + 9 + i * (colW + gap)}
          y={y0 + 7}
          w={colW}
          len={TRAY.h - 14}
          denom={denomination(value)}
          fill={TRAY_FILL[i]}
          seed={i + 1}
        />
      ))}
      <rect x={x0} y={y0} width={TRAY.w} height={10} rx="5" fill="#fff" opacity="0.05" />
    </g>
  )
}

/**
 * The six-deck shoe: smoked acrylic, the next card's back showing at the mouth.
 * Between hands it takes a double-click, which asks to shuffle up early.
 */
export const Shoe = memo(function Shoe({ back, onShuffle }: { back: CardBack; onShuffle?: () => void }) {
  return (
    <div
      className={`bj-shoe${onShuffle ? ' is-armed' : ''}`}
      style={{ left: SHOE.x, top: SHOE.y, transform: `rotateZ(${SHOE.angle}deg)` }}
      title={onShuffle ? 'Double-click to reshuffle' : undefined}
      onDoubleClick={onShuffle}
    >
      <div className="bj-shoe__shadow" />
      <Box3D
        w={124}
        d={196}
        h={70}
        faceClassName="bj-shoe__face"
        faces={{
          top: (
            <div className="bj-shoe__top">
              <div className="bj-shoe__deck">
                <CardBackFace theme={back} />
              </div>
            </div>
          ),
          front: <div className="bj-shoe__mouth" />,
          left: <div />,
          right: <div />,
        }}
      />
    </div>
  )
})

/**
 * The discard holder. The stack inside grows as the shoe is dealt, which is
 * the only honest penetration meter a real table has.
 */
export function DiscardRack({ fraction, back }: { fraction: number; back: CardBack }) {
  const height = Math.max(0, Math.min(1, fraction)) * 46
  return (
    <div className="bj-discard" style={{ left: DISCARD.x, top: DISCARD.y, transform: `rotateZ(${DISCARD.angle}deg)` }}>
      <div className="bj-discard__shadow" />
      <div className="bj-discard__floor" />
      {height > 1 && (
        <Box3D
          w={CARD.w * 0.86}
          d={CARD.h * 0.86}
          h={height}
          faceClassName="bj-discard__stack"
          faces={{
            top: (
              <div className="bj-discard__top">
                <CardBackFace theme={back} />
              </div>
            ),
            front: <div className="bj-discard__edge" />,
            left: <div className="bj-discard__edge" />,
            right: <div className="bj-discard__edge" />,
          }}
        />
      )}
      <Box3D
        w={CARD.w * 0.86 + 20}
        d={CARD.h * 0.86 + 20}
        h={56}
        faceClassName="bj-discard__glass"
        faces={{ front: <div />, left: <div />, right: <div />, back: <div /> }}
      />
    </div>
  )
}
