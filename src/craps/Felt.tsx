import { memo, useMemo, type ReactNode } from 'react'
import { ChipTube } from '../components/ChipTube'
import { denomination } from '../components/chips'
import { Soft } from '../components/Soft'
import { useEffectsLevel } from '../lib/effects'
import { noiseDataUrl } from '../lib/noise'
import {
  BOX_NUMBERS,
  CENTRE,
  FELT,
  LAYOUT as L,
  mirrorX,
  numberBox,
  PLANE,
  RAIL,
  rectPath,
  SPOTS,
  shapePath,
} from './layout'

/**
 * The craps table, drawn once.
 *
 * Everything here is static — the tub, the rail, the rubber pyramids, the
 * printed layout — so it renders a single time and the interactive layer on
 * top of it can light boxes up without repainting a table's worth of SVG.
 */

const OUTER_R = 210
const PRINT = 'var(--felt-print)'
const GOLD = '#e8c878'
const RED = '#ff6f63'
const LINE = 'rgba(246, 236, 210, 0.78)'

function Die({ x, y, size, value, tone = 'light' }: { x: number; y: number; size: number; value: number; tone?: 'light' | 'red' }) {
  const pips: Record<number, Array<[number, number]>> = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
  }
  const body = tone === 'red' ? '#c8182c' : '#f7f0e0'
  const pip = tone === 'red' ? '#fff' : '#1c1a22'
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2})`}>
      <rect width={size} height={size} rx={size * 0.2} fill={body} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      {pips[value].map(([px, py], i) => (
        <circle key={i} cx={px * size} cy={py * size} r={size * 0.09} fill={pip} />
      ))}
    </g>
  )
}

function Dice({ x, y, a, b, size = 26, gap = 5, tone }: { x: number; y: number; a: number; b: number; size?: number; gap?: number; tone?: 'light' | 'red' }) {
  return (
    <g>
      <Die x={x - size / 2 - gap / 2} y={y} size={size} value={a} tone={tone} />
      <Die x={x + size / 2 + gap / 2} y={y} size={size} value={b} tone={tone} />
    </g>
  )
}

function Label({
  x,
  y,
  children,
  size = 20,
  fill = PRINT,
  spacing = 4,
  family = 'Cinzel, serif',
  weight = 700,
  rotate,
  anchor = 'middle',
  opacity,
}: {
  x: number
  y: number
  children: ReactNode
  size?: number
  fill?: string
  spacing?: number
  family?: string
  weight?: number
  rotate?: number
  anchor?: 'start' | 'middle' | 'end'
  opacity?: number
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
      textAnchor={anchor}
      dominantBaseline="central"
      opacity={opacity}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      style={family.includes('Cormorant') ? { fontVariantNumeric: 'lining-nums' } : undefined}
    >
      {children}
    </text>
  )
}

/** One end of the layout. The far end is the same drawing, mirrored, with its words kept upright. */
function EndLayout({ mirrored }: { mirrored: boolean }) {
  const X = (x: number) => (mirrored ? mirrorX(x) : x)
  const box = (x0: number, y0: number, x1: number, y1: number, r = 8) =>
    rectPath(Math.min(X(x0), X(x1)), y0, Math.max(X(x0), X(x1)), y1, r)
  const passShape = SPOTS.find((s) => s.id === 'passLine')!.shape
  const midX = (L.inner + L.right) / 2

  return (
    <g>
      {/* The pass line: an L round the near side and up the end. */}
      <path
        d={shapePath(passShape)}
        transform={mirrored ? `translate(${PLANE.w} 0) scale(-1 1)` : undefined}
        fill="rgba(0,0,0,0.08)"
        stroke={LINE}
        strokeWidth="2.4"
      />
      <Label x={X(midX + 40)} y={(L.passY0 + L.passY1) / 2} size={32} spacing={22}>
        PASS LINE
      </Label>
      <Label x={X((L.passOuter + L.passInner) / 2)} y={470} size={26} spacing={18} rotate={mirrored ? 90 : -90}>
        PASS LINE
      </Label>

      {/* Don't pass */}
      <path d={box(L.inner, L.dpY0, L.right, L.dpY1)} fill="rgba(0,0,0,0.12)" stroke={LINE} strokeWidth="1.8" />
      <Label x={X(midX - 30)} y={(L.dpY0 + L.dpY1) / 2} size={17} spacing={7}>
        DON'T PASS BAR
      </Label>
      <Dice x={X(midX + 180)} y={(L.dpY0 + L.dpY1) / 2} a={6} b={6} size={20} gap={4} />

      {/* Field */}
      <path d={box(L.inner, L.fieldY0, L.right, L.fieldY1)} fill="rgba(0,0,0,0.05)" stroke={LINE} strokeWidth="1.8" />
      {[2, 3, 4, 9, 10, 11, 12].map((n, i) => {
        const x = X(L.inner + 52 + i * ((L.right - L.inner - 104) / 6))
        const special = n === 2 || n === 12
        return (
          <g key={n}>
            {special && <circle cx={x} cy={L.fieldY0 + 50} r={30} fill="none" stroke={GOLD} strokeWidth="2" />}
            <Label x={x} y={L.fieldY0 + 50} size={special ? 36 : 40} family="'Cormorant Garamond', serif" fill={GOLD} spacing={0}>
              {n}
            </Label>
            {special && (
              <Label x={x} y={L.fieldY0 + 94} size={12} spacing={3} fill={GOLD} opacity={0.9}>
                {n === 2 ? 'DOUBLE' : 'TRIPLE'}
              </Label>
            )}
          </g>
        )
      })}
      <Label x={X(midX)} y={L.fieldY1 - 24} size={22} spacing={26}>
        FIELD
      </Label>

      {/* Come */}
      <path d={box(L.inner, L.comeY0, L.right, L.comeY1)} fill="rgba(0,0,0,0.05)" stroke={LINE} strokeWidth="1.8" />
      <Label x={X(midX)} y={(L.comeY0 + L.comeY1) / 2} size={64} spacing={34} fill={RED}>
        COME
      </Label>

      {/* Don't come */}
      <path d={box(L.inner, L.numY0, L.dcX1, L.numY1)} fill="rgba(0,0,0,0.1)" stroke={LINE} strokeWidth="1.8" />
      <Label x={X((L.inner + L.dcX1) / 2)} y={(L.numY0 + L.numY1) / 2 + 10} size={16} spacing={7} rotate={mirrored ? 90 : -90}>
        DON'T COME BAR
      </Label>
      <Dice x={X((L.inner + L.dcX1) / 2)} y={L.numY1 - 26} a={6} b={6} size={18} gap={3} />

      {/* Box numbers */}
      {BOX_NUMBERS.map((n) => {
        const b = numberBox(n)
        const cx = X((b.x0 + b.x1) / 2)
        return (
          <g key={n}>
            <path d={box(b.x0, b.y0, b.x1, b.y1)} fill="rgba(0,0,0,0.06)" stroke={LINE} strokeWidth="1.8" />
            <line
              x1={Math.min(X(b.x0), X(b.x1)) + 8}
              x2={Math.max(X(b.x0), X(b.x1)) - 8}
              y1={b.y0 + 88}
              y2={b.y0 + 88}
              stroke={LINE}
              strokeOpacity="0.35"
              strokeDasharray="3 5"
            />
            <Label x={cx} y={b.y0 + 136} size={58} family="'Cormorant Garamond', serif" fill={GOLD} spacing={0}>
              {n}
            </Label>
            {(n === 6 || n === 9) && (
              <Label x={cx} y={b.y0 + 178} size={13} spacing={5} fill={GOLD} opacity={0.75}>
                {n === 6 ? 'SIX' : 'NINE'}
              </Label>
            )}
          </g>
        )
      })}
    </g>
  )
}

function Centre() {
  const s = (id: string) => SPOTS.find((spot) => spot.id === id)!.shape as { x0: number; y0: number; x1: number; y1: number }
  const mid = (id: string): [number, number] => {
    const r = s(id)
    return [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]
  }
  const prop = (id: string, a: number, b: number, pays: string, name?: string) => {
    const [x, y] = mid(id)
    return (
      <g key={id}>
        <path d={rectPath(s(id).x0, s(id).y0, s(id).x1, s(id).y1)} fill="rgba(0,0,0,0.1)" stroke={LINE} strokeWidth="1.6" />
        <Dice x={x} y={y - (name ? 16 : 12)} a={a} b={b} size={name ? 22 : 28} tone="red" />
        {name ? (
          <>
            <Label x={x} y={y + 12} size={13} spacing={2.5} fill={PRINT}>
              {name}
            </Label>
            <Label x={x} y={y + 29} size={12} spacing={2} fill={GOLD}>
              {pays}
            </Label>
          </>
        ) : (
          <Label x={x} y={y + 26} size={15} spacing={3} fill={GOLD}>
            {pays}
          </Label>
        )}
      </g>
    )
  }
  const plain = (id: string, text: string, sub: string, fill = PRINT) => {
    const [x, y] = mid(id)
    return (
      <g key={id}>
        <path d={rectPath(s(id).x0, s(id).y0, s(id).x1, s(id).y1)} fill="rgba(0,0,0,0.1)" stroke={LINE} strokeWidth="1.6" />
        <Label x={x} y={y - 7} size={16} spacing={5} fill={fill}>
          {text}
        </Label>
        <Label x={x} y={y + 12} size={12} spacing={2} fill={GOLD} opacity={0.9}>
          {sub}
        </Label>
      </g>
    )
  }

  return (
    <g>
      <path
        d={rectPath(CENTRE.x0 - 10, 124, CENTRE.x1 + 10, 700, 14)}
        fill="rgba(0,0,0,0.14)"
        stroke={GOLD}
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      {(() => {
        const [x, y] = mid('any7')
        return (
          <g>
            <path d={rectPath(s('any7').x0, s('any7').y0, s('any7').x1, s('any7').y1)} fill="rgba(200, 30, 40, 0.18)" stroke={LINE} strokeWidth="1.6" />
            <Label x={x} y={y - 7} size={22} spacing={12} fill={RED}>
              SEVEN
            </Label>
            <Label x={x} y={y + 15} size={12} spacing={3} fill={GOLD}>
              ANY SEVEN · 4 TO 1
            </Label>
          </g>
        )
      })()}
      {prop('hard-6', 3, 3, '9 TO 1')}
      {prop('hard-10', 5, 5, '7 TO 1')}
      {prop('hard-8', 4, 4, '9 TO 1')}
      {prop('hard-4', 2, 2, '7 TO 1')}
      {prop('two', 1, 1, '30 TO 1', 'ACES')}
      {prop('twelve', 6, 6, '30 TO 1', 'BOXCARS')}
      {prop('three', 1, 2, '15 TO 1', 'ACE-DEUCE')}
      {prop('eleven', 5, 6, '15 TO 1', 'YO')}
      {plain('horn', 'HORN', '2 · 3 · 11 · 12')}
      {plain('world', 'WORLD', '7 PUSHES')}
      {(() => {
        const [x, y] = mid('ce')
        return (
          <g>
            <path d={rectPath(s('ce').x0, s('ce').y0, s('ce').x1, s('ce').y1)} fill="rgba(0,0,0,0.1)" stroke={LINE} strokeWidth="1.6" />
            <circle cx={x - 16} cy={y} r={15} fill="none" stroke={RED} strokeWidth="1.6" />
            <circle cx={x + 16} cy={y} r={15} fill="none" stroke={GOLD} strokeWidth="1.6" />
            <Label x={x - 16} y={y + 1} size={15} spacing={0} fill={RED}>
              C
            </Label>
            <Label x={x + 16} y={y + 1} size={15} spacing={0} fill={GOLD}>
              E
            </Label>
          </g>
        )
      })()}
      {(() => {
        const [x, y] = mid('anyCraps')
        return (
          <g>
            <path d={rectPath(s('anyCraps').x0, s('anyCraps').y0, s('anyCraps').x1, s('anyCraps').y1)} fill="rgba(200, 30, 40, 0.14)" stroke={LINE} strokeWidth="1.6" />
            <Label x={x} y={y - 8} size={17} spacing={7} fill={RED}>
              ANY CRAPS
            </Label>
            <Label x={x} y={y + 13} size={12} spacing={2.5} fill={GOLD}>
              2 · 3 · 12 — 7 TO 1
            </Label>
          </g>
        )
      })()}

      {/* Side bets */}
      {/* Room in a circle runs out fast below the middle, so the Fire's "up to" gets a line of its own. */}
      {[
        { id: 'fire', name: 'FIRE', pays: ['UP TO', '999:1'] },
        { id: 'small', name: 'SMALL', pays: ['30 TO 1'] },
        { id: 'tall', name: 'TALL', pays: ['30 TO 1'] },
        { id: 'all', name: 'ALL', pays: ['150 TO 1'] },
      ].map(({ id, name, pays }) => {
        const shape = SPOTS.find((sp) => sp.id === id)!.shape as { cx: number; cy: number; r: number }
        const top = pays.length > 1 ? shape.cy - 14 : shape.cy - 8
        return (
          <g key={id}>
            <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill="rgba(0,0,0,0.16)" stroke={id === 'fire' ? '#ff8a4c' : GOLD} strokeWidth="2" />
            <circle cx={shape.cx} cy={shape.cy} r={shape.r - 6} fill="none" stroke={id === 'fire' ? '#ff8a4c' : GOLD} strokeOpacity="0.4" strokeWidth="1" />
            <Label x={shape.cx} y={top} size={13} spacing={2} fill={id === 'fire' ? '#ffb07a' : PRINT}>
              {name}
            </Label>
            {pays.map((line, i) => (
              <Label key={line} x={shape.cx} y={top + 16 + i * 14} size={12} spacing={0.5} fill={GOLD} opacity={0.9}>
                {line}
              </Label>
            ))}
          </g>
        )
      })}
    </g>
  )
}

/** The pyramid rubber lining the tub: a lattice of tiny lit diamonds. */
function PyramidPattern() {
  return (
    <pattern id="cr-pyramids" width="14" height="14" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill="#15141a" />
      <path d="M7 0 L14 7 L7 7 Z" fill="#4a4652" />
      <path d="M0 7 L7 0 L7 7 Z" fill="#2e2b35" />
      <path d="M0 7 L7 7 L7 14 Z" fill="#1c1a21" />
      <path d="M7 7 L14 7 L7 14 Z" fill="#0b0a0e" />
    </pattern>
  )
}

const TRAY_VALUES = [5000, 1000, 1000, 500, 500, 100, 100, 100, 25, 25, 25, 5, 5, 5, 1, 1]
const TRAY_FILL = [0.7, 0.85, 1, 0.9, 1, 1, 0.9, 1, 1, 0.95, 0.85, 1, 0.92, 1, 0.9, 0.8]

export const CrapsFelt = memo(function CrapsFelt() {
  const noise = useMemo(() => noiseDataUrl(), [])
  // Lighter effects lay the felt's grain and light on unblended, and leave the
  // grain off the dark wood and leather, where blended it barely shows (see Soft).
  const light = useEffectsLevel() === 'reduced'
  const outer = rectPath(0, 0, PLANE.w, PLANE.h, OUTER_R)
  const railInner = rectPath(RAIL, RAIL, PLANE.w - RAIL, PLANE.h - RAIL, OUTER_R - RAIL)
  const felt = rectPath(FELT.x0, FELT.y0, FELT.x1, FELT.y1, FELT.r)

  return (
    <svg className="cr-felt" width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`} aria-hidden="true">
      <defs>
        <radialGradient id="cr-felt-g" gradientUnits="userSpaceOnUse" cx={700} cy={420} r={1100}>
          <stop offset="0" style={{ stopColor: 'var(--felt-hi)' }} />
          <stop offset="0.4" style={{ stopColor: 'var(--felt-mid)' }} />
          <stop offset="0.82" style={{ stopColor: 'var(--felt-lo)' }} />
          <stop offset="1" style={{ stopColor: 'var(--felt-edge)' }} />
        </radialGradient>
        <radialGradient id="cr-spot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff2d0" stopOpacity="0.22" />
          <stop offset="0.6" stopColor="#fff6dc" stopOpacity="0.07" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cr-rail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#23141a" />
          <stop offset="0.5" stopColor="#140a0e" />
          <stop offset="1" stopColor="#2b171d" />
        </linearGradient>
        <linearGradient id="cr-rail-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.12" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.88" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.08" />
        </linearGradient>
        <pattern id="cr-noise" width="256" height="256" patternUnits="userSpaceOnUse">
          <image href={noise} width="256" height="256" />
        </pattern>
        <PyramidPattern />
        <clipPath id="cr-felt-clip">
          <path d={felt} />
        </clipPath>
        <filter id="cr-rail-blur" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="cr-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="cr-shadow" x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="34" />
        </filter>
      </defs>

      {/* The table itself, which a phone leaves out (see the blackjack table).
          The bank goes with it: set into the far rail, it would sit under the
          top bar there. */}
      <g className="table-body">
        {/* The table's shadow on the floor, then the tub itself. */}
        <Soft blur={34} filter="url(#cr-shadow)">
          <rect x="40" y="120" width={PLANE.w - 80} height={PLANE.h - 40} rx={OUTER_R} fill="#000" opacity="0.75" />
        </Soft>
        {/* The padded leather rail: dark, rounding up to a soft highlight along its crown. */}
        <path d={outer} fill="#0d090a" />
        <Soft blur={5} filter="url(#cr-rail-blur)">
          <path d={rectPath(24, 24, PLANE.w - 24, PLANE.h - 24, OUTER_R - 24)} fill="none" stroke="#33272a" strokeWidth="30" />
        </Soft>
        <Soft blur={5} filter="url(#cr-rail-blur)">
          <path d={rectPath(27, 27, PLANE.w - 27, PLANE.h - 27, OUTER_R - 27)} fill="none" stroke="#715c60" strokeWidth="7" opacity="0.55" />
        </Soft>
        {!light && <path d={outer} fill="url(#cr-noise)" opacity="0.25" style={{ mixBlendMode: 'overlay' }} />}
        <path d={outer} fill="url(#cr-rail-sheen)" />
        <path d={rectPath(10, 10, PLANE.w - 10, PLANE.h - 10, OUTER_R - 10)} fill="none" stroke="#b58e5e" strokeOpacity="0.35" strokeWidth="1.3" strokeDasharray="7 5" />
        <path d={railInner} fill="#0a0709" />

        {/* The dealers' bank, set into the far rail. */}
        <g>
          <rect x="690" y="14" width="620" height="44" rx="8" fill="#0d0c11" stroke="url(#gold-foil)" strokeWidth="1.4" />
          {TRAY_VALUES.map((value, i) => (
            <ChipTube key={i} x={700 + i * 37.5} y={19} w={32} len={34} denom={denomination(value)} fill={TRAY_FILL[i]} seed={i + 3} />
          ))}
        </g>

        {/* Pyramid rubber, then the felt inside it. */}
        <path d={railInner} fill="url(#cr-pyramids)" />
        <path d={railInner} fill="none" stroke="url(#gold-foil)" strokeWidth="2.4" />
        <path d={felt} fill="url(#cr-felt-g)" />
        <g clipPath="url(#cr-felt-clip)">
          <rect width={PLANE.w} height={PLANE.h} fill="url(#cr-noise)" opacity="0.15" style={light ? undefined : { mixBlendMode: 'overlay' }} />
          <ellipse cx="520" cy="460" rx="620" ry="420" fill="url(#cr-spot)" style={light ? undefined : { mixBlendMode: 'screen' }} />
          <ellipse cx="1150" cy="420" rx="520" ry="380" fill="url(#cr-spot)" style={light ? undefined : { mixBlendMode: 'screen' }} opacity="0.8" />
          <Soft blur={18} filter="url(#cr-soft)">
            <path d={felt} fill="none" stroke="#000" strokeOpacity="0.6" strokeWidth="60" />
          </Soft>
        </g>
        <path d={felt} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
      </g>

      {/* Printing */}
      <EndLayout mirrored={false} />
      <g opacity="0.34">
        <EndLayout mirrored />
      </g>
      <Centre />

    </svg>
  )
})
