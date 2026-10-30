import { memo, useMemo, type ReactNode } from 'react'
import { FELT, PLANE, TABLE, TRAY } from '../blackjack/geometry'
import { useEffectsLevel } from '../lib/effects'
import { noiseDataUrl } from '../lib/noise'
import { ChipTube } from './ChipTube'
import { denomination } from './chips'
import { Soft } from './Soft'

/**
 * The D-shaped card table every carnival game in the pit is dealt on — the
 * blackjack table's walnut, padded rail and pendant-lit felt, with the dealer's
 * chip tray at the straight edge. Each game prints its own layout over it.
 *
 * Laid out on the blackjack plane, in the blackjack geometry, so a baccarat or
 * hold'em table seen from the seat sits in the room exactly where blackjack
 * does.
 */

const { cx, edgeY } = TABLE

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
const TRAY_FILL = [0.7, 0.85, 0.9, 1, 0.95, 1, 1, 0.85, 1, 0.92]

export const DTable = memo(function DTable({
  id,
  className,
  defs,
  trayWidth,
  children,
}: {
  /** Prefix for the SVG ids, so two tables never share a gradient. */
  id: string
  className?: string
  /** Extra `<defs>` the printing needs — text arcs, mostly. */
  defs?: ReactNode
  /** A narrower tray, where printing flanks it. */
  trayWidth?: number
  /** The printing: drawn on the felt, under the tray. */
  children?: ReactNode
}) {
  const noise = useMemo(() => noiseDataUrl(), [])
  // Lighter effects lay the felt's grain and light on unblended, and leave the
  // grain off the dark wood and leather, where blended it barely shows (see Soft).
  const light = useEffectsLevel() === 'reduced'
  const railScale = TABLE.rx / TABLE.ry
  const ref = (name: string) => `url(#${id}-${name})`

  return (
    <svg className={`d-table${className ? ` ${className}` : ''}`} width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-felt`} gradientUnits="userSpaceOnUse" cx={cx} cy={330} r={760}>
          <stop offset="0" style={{ stopColor: 'var(--felt-hi)' }} />
          <stop offset="0.42" style={{ stopColor: 'var(--felt-mid)' }} />
          <stop offset="0.8" style={{ stopColor: 'var(--felt-lo)' }} />
          <stop offset="1" style={{ stopColor: 'var(--felt-edge)' }} />
        </radialGradient>
        <radialGradient id={`${id}-spot`} gradientUnits="userSpaceOnUse" cx={cx} cy={360} r={520}>
          <stop offset="0" stopColor="#fff2d0" stopOpacity="0.24" />
          <stop offset="0.55" stopColor="#fff2d0" stopOpacity="0.07" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={`${id}-rail`}
          gradientUnits="userSpaceOnUse"
          cx={cx}
          cy={edgeY}
          r={TABLE.ry}
          gradientTransform={`translate(${cx} ${edgeY}) scale(${railScale} 1) translate(${-cx} ${-edgeY})`}
        >
          <stop offset="0.9" stopColor="#0a0708" />
          <stop offset="0.921" stopColor="#120c0d" />
          <stop offset="0.932" stopColor="#2e2225" />
          <stop offset="0.945" stopColor="#5f4b4f" />
          <stop offset="0.956" stopColor="#3d2e31" />
          <stop offset="0.974" stopColor="#1c1416" />
          <stop offset="0.992" stopColor="#0c0809" />
          <stop offset="1" stopColor="#040203" />
        </radialGradient>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#2a160c" />
          <stop offset="0.3" stopColor="#5a3319" />
          <stop offset="0.5" stopColor="#3b2011" />
          <stop offset="0.72" stopColor="#62391c" />
          <stop offset="1" stopColor="#2a160c" />
        </linearGradient>
        <pattern id={`${id}-noise`} width="256" height="256" patternUnits="userSpaceOnUse">
          <image href={noise} width="256" height="256" />
        </pattern>
        <clipPath id={`${id}-felt-clip`}>
          <path d={FELT_PATH} />
        </clipPath>
        <filter id={`${id}-soft`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="30" />
        </filter>
        {defs}
      </defs>

      {/* The table itself, which a phone leaves out (see the blackjack table). */}
      <g className="table-body">
        <Soft blur={30} filter={ref('shadow')}>
          <ellipse cx={cx} cy={edgeY + 360} rx={WOOD.rx + 30} ry={WOOD.ry * 0.62} fill="#000" opacity="0.7" />
        </Soft>

        <path d={WOOD_PATH} fill={ref('wood')} />
        {!light && <path d={WOOD_PATH} fill={ref('noise')} opacity="0.18" style={{ mixBlendMode: 'overlay' }} />}
        <path d={RAIL_PATH} fill={ref('rail')} />
        {!light && <path d={RAIL_PATH} fill={ref('noise')} opacity="0.22" style={{ mixBlendMode: 'overlay' }} />}
        <path d={ellipseArc(TABLE.rx - 9, TABLE.ry - 9)} fill="none" stroke="#b58e5e" strokeOpacity="0.4" strokeWidth="1.3" strokeDasharray="6 5" />
        <path d={ellipseArc(FELT.rx + 9, FELT.ry + 9)} fill="none" stroke="#b58e5e" strokeOpacity="0.3" strokeWidth="1.1" strokeDasharray="6 5" />

        <path d={FELT_PATH} fill={ref('felt')} />
        <g clipPath={ref('felt-clip')}>
          <rect width={PLANE.w} height={PLANE.h} fill={ref('noise')} opacity="0.16" style={light ? undefined : { mixBlendMode: 'overlay' }} />
          <ellipse cx={cx} cy={360} rx={700} ry={470} fill={ref('spot')} style={light ? undefined : { mixBlendMode: 'screen' }} />
          <Soft blur={16} filter={ref('soft')}>
            <path d={ellipseArc(FELT.rx, FELT.ry)} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="46" />
          </Soft>
          <Soft blur={16} filter={ref('soft')}>
            <rect x={cx - FELT.rx} y={edgeY - 30} width={FELT.rx * 2} height={46} fill="#000" opacity="0.45" />
          </Soft>
        </g>
        <path d={ellipseArc(FELT.rx - 1, FELT.ry - 1)} fill="none" stroke="url(#gold-foil)" strokeWidth="3.2" />
        <path d={ellipseArc(FELT.rx - 10, FELT.ry - 10)} fill="none" stroke="#e3c170" strokeOpacity="0.35" strokeWidth="1" />
        <line x1={cx - FELT.rx} y1={edgeY + 1} x2={cx + FELT.rx} y2={edgeY + 1} stroke="url(#gold-foil)" strokeWidth="3" />
      </g>

      {children}

      <ChipTray w={trayWidth} />
    </svg>
  )
})

/** The dealer's tray at the straight edge: the house's money, in tubes. */
export function ChipTray({ x = TRAY.x, y = TRAY.y, w = TRAY.w, h = TRAY.h }: { x?: number; y?: number; w?: number; h?: number }) {
  const x0 = x - w / 2
  const y0 = y - h / 2
  const colW = Math.max(38, Math.round(w * 0.08))
  const gap = (w - 18 - TRAY_COLUMNS.length * colW) / (TRAY_COLUMNS.length - 1)
  return (
    <g>
      <rect x={x0 - 6} y={y0 - 6} width={w + 12} height={h + 12} rx="10" fill="#050407" opacity="0.55" />
      <rect x={x0} y={y0} width={w} height={h} rx="7" fill="#15141a" stroke="url(#gold-foil)" strokeWidth="1.6" />
      {TRAY_COLUMNS.map((value, i) => (
        <ChipTube
          key={i}
          x={x0 + 9 + i * (colW + gap)}
          y={y0 + 7}
          w={colW}
          len={h - 14}
          denom={denomination(value)}
          fill={TRAY_FILL[i]}
          seed={i + 1}
        />
      ))}
      <rect x={x0} y={y0} width={w} height={10} rx="5" fill="#fff" opacity="0.05" />
    </g>
  )
}

/** A felt-printed label, in the house's Deco face. */
export function FeltText({
  x,
  y,
  size,
  children,
  spacing = 4,
  weight = 700,
  opacity = 0.85,
  gold = false,
  anchor = 'middle',
}: {
  x: number
  y: number
  size: number
  children: ReactNode
  spacing?: number
  weight?: number
  opacity?: number
  gold?: boolean
  anchor?: 'start' | 'middle' | 'end'
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily="Cinzel, serif"
      fontWeight={weight}
      fontSize={size}
      letterSpacing={spacing}
      fill={gold ? 'url(#gold-foil)' : 'var(--felt-print)'}
      opacity={opacity}
    >
      {children}
    </text>
  )
}
