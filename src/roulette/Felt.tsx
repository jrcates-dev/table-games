import { memo, useMemo } from 'react'
import { ChipTray } from '../components/DTable'
import { Monogram } from '../components/TopBar'
import { DOUBLE_ZERO, pocketColor, pocketLabel, pockets, type WheelType } from '../engine/roulette/wheel'
import { noiseDataUrl } from '../lib/noise'
import {
  BANK,
  COL_X1,
  DOZEN_BOTTOM,
  EVEN_BOTTOM,
  GRID,
  GRID_BOTTOM,
  NUM_X0,
  NUM_X1,
  outsideRect,
  PLANE,
  pocketRect,
  TABLE,
  WHEEL,
  type Rect,
} from './geometry'

/**
 * The roulette table, drawn once per wheel: walnut and a padded rail round a
 * long felt, the bowl the wheel sits in, and the American layout printed in
 * the house's gold.
 */

const LINE = 'rgba(246, 236, 210, 0.82)'
const PRINT = 'var(--felt-print)'
const RED = '#b51d28'
const BLACK = '#131116'
const GREEN = '#0f7a44'

export const RouletteFelt = memo(function RouletteFelt({ wheel }: { wheel: WheelType }) {
  const noise = useMemo(() => noiseDataUrl(), [])
  const inset = 12
  const felt = inset + TABLE.rail
  return (
    <svg className="ro-felt" width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`} aria-hidden="true">
      <defs>
        <radialGradient id="ro-felt" gradientUnits="userSpaceOnUse" cx={880} cy={380} r={900}>
          <stop offset="0" style={{ stopColor: 'var(--felt-hi)' }} />
          <stop offset="0.45" style={{ stopColor: 'var(--felt-mid)' }} />
          <stop offset="0.85" style={{ stopColor: 'var(--felt-lo)' }} />
          <stop offset="1" style={{ stopColor: 'var(--felt-edge)' }} />
        </radialGradient>
        <linearGradient id="ro-wood" x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor="#2a160c" />
          <stop offset="0.3" stopColor="#5a3319" />
          <stop offset="0.5" stopColor="#3b2011" />
          <stop offset="0.72" stopColor="#62391c" />
          <stop offset="1" stopColor="#2a160c" />
        </linearGradient>
        <linearGradient id="ro-rail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2e2225" />
          <stop offset="0.5" stopColor="#120c0d" />
          <stop offset="1" stopColor="#2a1f21" />
        </linearGradient>
        <radialGradient id="ro-spot" gradientUnits="userSpaceOnUse" cx={900} cy={360} r={620}>
          <stop offset="0" stopColor="#fff2d0" stopOpacity="0.2" />
          <stop offset="0.6" stopColor="#fff2d0" stopOpacity="0.05" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </radialGradient>
        <pattern id="ro-noise" width="256" height="256" patternUnits="userSpaceOnUse">
          <image href={noise} width="256" height="256" />
        </pattern>
        <clipPath id="ro-felt-clip">
          <rect x={felt} y={felt} width={PLANE.w - 2 * felt} height={PLANE.h - 2 * felt} rx={TABLE.r - felt} />
        </clipPath>
        <filter id="ro-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <rect x="0" y="0" width={PLANE.w} height={PLANE.h} rx={TABLE.r} fill="url(#ro-wood)" />
      <rect x="0" y="0" width={PLANE.w} height={PLANE.h} rx={TABLE.r} fill="url(#ro-noise)" opacity="0.18" style={{ mixBlendMode: 'overlay' }} />
      <rect x={inset} y={inset} width={PLANE.w - 2 * inset} height={PLANE.h - 2 * inset} rx={TABLE.r - inset} fill="url(#ro-rail)" />
      <rect
        x={inset + TABLE.rail / 2}
        y={inset + TABLE.rail / 2}
        width={PLANE.w - 2 * inset - TABLE.rail}
        height={PLANE.h - 2 * inset - TABLE.rail}
        rx={TABLE.r - inset - TABLE.rail / 2}
        fill="none"
        stroke="#5f4b4f"
        strokeOpacity="0.55"
        strokeWidth="10"
        filter="url(#ro-soft)"
      />
      <rect x={inset + 8} y={inset + 8} width={PLANE.w - 2 * inset - 16} height={PLANE.h - 2 * inset - 16} rx={TABLE.r - inset - 8} fill="none" stroke="#b58e5e" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="6 5" />

      <rect x={felt} y={felt} width={PLANE.w - 2 * felt} height={PLANE.h - 2 * felt} rx={TABLE.r - felt} fill="url(#ro-felt)" />
      <g clipPath="url(#ro-felt-clip)">
        <rect width={PLANE.w} height={PLANE.h} fill="url(#ro-noise)" opacity="0.16" style={{ mixBlendMode: 'overlay' }} />
        <ellipse cx={900} cy={380} rx={760} ry={420} fill="url(#ro-spot)" style={{ mixBlendMode: 'screen' }} />
        <rect x={felt} y={felt} width={PLANE.w - 2 * felt} height={PLANE.h - 2 * felt} rx={TABLE.r - felt} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="40" filter="url(#ro-soft)" />
        {/* The bowl's shadow on the felt. */}
        <circle cx={WHEEL.cx} cy={WHEEL.cy + 10} r={WHEEL.bowl + 40} fill="#000" opacity="0.35" filter="url(#ro-soft)" />
      </g>
      <rect x={felt + 1} y={felt + 1} width={PLANE.w - 2 * felt - 2} height={PLANE.h - 2 * felt - 2} rx={TABLE.r - felt - 1} fill="none" stroke="url(#gold-foil)" strokeWidth="3" />

      <ChipTray x={BANK[0]} y={BANK[1] + 52} w={420} h={62} />
      <Layout wheel={wheel} />
      <g transform={`translate(${(GRID.x0 + NUM_X0) / 2 - 26} ${(GRID_BOTTOM + EVEN_BOTTOM) / 2 - 26}) scale(0.82)`} opacity="0.3">
        <Monogram size={64} />
      </g>
    </svg>
  )
})

function Text({ x, y, size, children, fill = PRINT, spacing = 3, family = 'Cinzel, serif', weight = 700, rotate }: {
  x: number
  y: number
  size: number
  children: React.ReactNode
  fill?: string
  spacing?: number
  family?: string
  weight?: number
  rotate?: number
}) {
  return (
    <text
      x={x}
      y={y}
      fontFamily={family}
      fontWeight={weight}
      fontSize={size}
      letterSpacing={spacing}
      fill={fill}
      textAnchor="middle"
      dominantBaseline="central"
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      style={family.includes('Cormorant') ? { fontVariantNumeric: 'lining-nums' } : undefined}
    >
      {children}
    </text>
  )
}

const box = (r: Rect, inset = 0) => ({ x: r.x0 + inset, y: r.y0 + inset, width: r.x1 - r.x0 - 2 * inset, height: r.y1 - r.y0 - 2 * inset })
const mid = (r: Rect): [number, number] => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]

function Layout({ wheel }: { wheel: WheelType }) {
  const numbers = pockets(wheel)
  return (
    <g>
      {/* Numbers and zeros. */}
      {numbers.map((pocket) => {
        const r = pocketRect(pocket, wheel)
        const colour = pocketColor(pocket)
        const [x, y] = mid(r)
        const zero = colour === 'green'
        return (
          <g key={pocket}>
            {zero ? (
              <ZeroBox pocket={pocket} wheel={wheel} r={r} />
            ) : (
              <rect {...box(r, 7)} rx="7" fill={colour === 'red' ? RED : BLACK} opacity="0.92" />
            )}
            <Text x={x} y={y + 1} size={zero ? 30 : 32} family="Cormorant Garamond, serif" fill="#f6efe0" spacing={0}>
              {pocketLabel(pocket)}
            </Text>
          </g>
        )
      })}

      {/* Columns. */}
      {[1, 2, 3].map((n) => {
        const r = outsideRect(`column:${n}`)!
        const [x, y] = mid(r)
        return (
          <Text key={n} x={x} y={y} size={14} rotate={-90} spacing={2}>
            2 TO 1
          </Text>
        )
      })}
      {/* Dozens. */}
      {['1st 12', '2nd 12', '3rd 12'].map((label, i) => {
        const [x, y] = mid(outsideRect(`dozen:${i + 1}`)!)
        return (
          <Text key={label} x={x} y={y} size={24} spacing={5}>
            {label.toUpperCase()}
          </Text>
        )
      })}
      {/* Even money. */}
      {(['low', 'even', 'red', 'black', 'odd', 'high'] as const).map((kind) => {
        const r = outsideRect(kind)!
        const [x, y] = mid(r)
        if (kind === 'red' || kind === 'black') {
          return <path key={kind} d={`M ${x} ${y - 26} L ${x + 44} ${y} L ${x} ${y + 26} L ${x - 44} ${y} Z`} fill={kind === 'red' ? RED : BLACK} stroke={LINE} strokeWidth="1.6" />
        }
        const label = { low: '1 TO 18', even: 'EVEN', odd: 'ODD', high: '19 TO 36' }[kind]
        return (
          <Text key={kind} x={x} y={y} size={kind === 'low' || kind === 'high' ? 17 : 20} spacing={kind === 'low' || kind === 'high' ? 2 : 5}>
            {label}
          </Text>
        )
      })}

      <GridLines wheel={wheel} />
    </g>
  )
}

/** The zeros' boxes, their outer corners cut to follow the layout's pointed end. */
function ZeroBox({ pocket, wheel, r }: { pocket: number; wheel: WheelType; r: Rect }) {
  const inset = 7
  const cut = 20
  const x0 = r.x0 + inset
  const x1 = r.x1 - inset
  const y0 = r.y0 + inset
  const y1 = r.y1 - inset
  const cutTop = wheel === 'single' || pocket === DOUBLE_ZERO
  const cutBottom = wheel === 'single' || pocket === 0
  const d = [
    `M ${x0 + (cutTop ? cut * 0.6 : 0)} ${y0}`,
    `L ${x1} ${y0}`,
    `L ${x1} ${y1}`,
    `L ${x0 + (cutBottom ? cut * 0.6 : 0)} ${y1}`,
    cutBottom ? `L ${x0} ${y1 - cut}` : '',
    cutTop ? `L ${x0} ${y0 + cut}` : '',
    'Z',
  ].join(' ')
  return <path d={d} fill={GREEN} opacity="0.92" />
}

function GridLines({ wheel }: { wheel: WheelType }) {
  const lines: string[] = []
  const top = GRID.top
  // The outline of the whole layout.
  lines.push(`M ${GRID.x0 + 24} ${top} L ${COL_X1} ${top} L ${COL_X1} ${GRID_BOTTOM} L ${NUM_X1} ${GRID_BOTTOM}`)
  lines.push(`M ${NUM_X1} ${GRID_BOTTOM} L ${NUM_X1} ${EVEN_BOTTOM} L ${NUM_X0} ${EVEN_BOTTOM} L ${NUM_X0} ${GRID_BOTTOM}`)
  lines.push(`M ${GRID.x0 + 24} ${top} L ${GRID.x0} ${top + 40} L ${GRID.x0} ${GRID_BOTTOM - 40} L ${GRID.x0 + 24} ${GRID_BOTTOM} L ${NUM_X0} ${GRID_BOTTOM}`)
  // Rows and columns.
  for (let r = 1; r < 3; r++) lines.push(`M ${NUM_X0} ${top + r * GRID.rowH} L ${COL_X1} ${top + r * GRID.rowH}`)
  for (let c = 0; c <= 12; c++) lines.push(`M ${NUM_X0 + c * GRID.cellW} ${top} L ${NUM_X0 + c * GRID.cellW} ${GRID_BOTTOM}`)
  lines.push(`M ${NUM_X0} ${GRID_BOTTOM} L ${NUM_X1} ${GRID_BOTTOM}`)
  lines.push(`M ${NUM_X0} ${DOZEN_BOTTOM} L ${NUM_X1} ${DOZEN_BOTTOM}`)
  for (let d = 1; d < 3; d++) lines.push(`M ${NUM_X0 + d * 4 * GRID.cellW} ${GRID_BOTTOM} L ${NUM_X0 + d * 4 * GRID.cellW} ${DOZEN_BOTTOM}`)
  for (let e = 1; e < 6; e++) lines.push(`M ${NUM_X0 + e * 2 * GRID.cellW} ${DOZEN_BOTTOM} L ${NUM_X0 + e * 2 * GRID.cellW} ${EVEN_BOTTOM}`)
  // Between the two zeros.
  if (wheel === 'double') lines.push(`M ${GRID.x0} ${top + 1.5 * GRID.rowH} L ${NUM_X0} ${top + 1.5 * GRID.rowH}`)
  return <path d={lines.join(' ')} fill="none" stroke={LINE} strokeWidth="2.2" strokeLinejoin="round" />
}
