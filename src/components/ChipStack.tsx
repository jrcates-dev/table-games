import { memo, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { ChipFace } from './Chip'
import { chipBreakdown, type Denomination } from './chips'

/**
 * A stack of chips standing on the felt.
 *
 * The table is a tilted plane, and chips have height, so a stack is drawn as a
 * billboard: an upright picture whose geometry is worked out for the angle the
 * felt is seen at. Each chip is a side band — body colour under cylindrical
 * shading, with its edge inserts wrapping round the visible half — and the top
 * chip shows its whole face, squashed to the same ellipse. Chips are rotated
 * individually, so no two stacks look stamped.
 */

export interface StackGeometry {
  /** SVG width and height. */
  width: number
  height: number
  /** Where the stack meets the felt, inside the SVG. */
  baseX: number
  baseY: number
}

interface Props {
  amount?: number
  chips?: Denomination[]
  /** Chip diameter in px. */
  size?: number
  /** Angle between the line of sight and the felt's normal, degrees. */
  tilt?: number
  /** Varies the rotation of each chip between stacks. */
  seed?: number
  /** A dealer never builds a stack taller than this; the rest start a new one. */
  perColumn?: number
  className?: string
  style?: CSSProperties
  /** Stand the picture up out of the felt. Off for flat, screen-space use. */
  billboard?: boolean
  /** Drop every chip in on first appearance, rather than only chips added later. */
  dropIn?: boolean
}

/**
 * Chip thickness over diameter. A real clay chip is about 0.085; a touch over
 * that keeps a single chip's edge legible without it passing for two.
 */
const THICKNESS = 0.1

function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function columnsOf<T>(items: T[], per: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per))
  return out
}

/**
 * Where a smaller chip sits on a bigger one: stepped aside, as fractions of
 * the diameter, far enough that the value printed on the bigger chip shows
 * beside the chips above it. Each change of denomination steps once more, so
 * every value in the stack can be read, and the whole stack stays centred on
 * its spot.
 */
const STEP = 0.6

function stackGeometry(count: number, size: number, tilt: number, columns = 1, reach = 0): StackGeometry {
  const t = (tilt * Math.PI) / 180
  const r = size / 2
  const ry = r * Math.cos(t)
  const hs = size * THICKNESS * Math.sin(t)
  const gap = size * 0.08
  const width = columns * size + (columns - 1) * gap + 2 + reach
  const height = 2 * ry + count * hs + 2
  return { width, height, baseX: width / 2, baseY: height - ry - 1 }
}

/** How far each chip has stepped aside from the foot of its column, in px. */
function stepsOf(column: ChipDraw[], size: number): number[] {
  let x = 0
  return column.map((chip, i) => {
    if (i > 0 && chip.denom.value < column[i - 1].denom.value) x += size * STEP
    return x
  })
}

interface ChipDraw {
  denom: Denomination
  rot: number
  /** The denomination stays near upright, as a dealer squares a chip to read it. */
  label: number
  /** Sideways slop, as a fraction of the diameter: no hand-built stack is a perfect column. */
  slop: number
}

/** The visible side of one chip: a band between two lower half-ellipses. */
function Band({
  cx,
  y,
  r,
  ry,
  hs,
  chip,
  top = false,
  fresh,
  delay,
}: {
  cx: number
  y: number
  r: number
  ry: number
  hs: number
  chip: ChipDraw
  /** The chip's face is showing, so its edge runs straight on from the face with no seam. */
  top?: boolean
  fresh: boolean
  delay: number
}) {
  const band = `M ${cx - r} ${y} L ${cx - r} ${y + hs} A ${r} ${ry} 0 0 0 ${cx + r} ${y + hs} L ${cx + r} ${y} A ${r} ${ry} 0 0 1 ${cx - r} ${y} Z`

  // Inserts on the front half. Angles run clockwise from twelve o'clock in the
  // chip's own top view; the front of the chip is six o'clock.
  const inserts: string[] = []
  for (let k = 0; k < 6; k++) {
    const centre = (((chip.rot + k * 60) % 360) + 360) % 360
    // Clipped to the half facing the viewer; an insert round the back is
    // simply not there. Nothing visible can straddle twelve o'clock.
    const a0 = Math.max(90.5, centre - 11)
    const a1 = Math.min(269.5, centre + 11)
    if (a1 <= a0) continue
    const at = (s: number) => ((a0 + ((a1 - a0) * s) / 4) * Math.PI) / 180
    const pts: string[] = []
    for (let s = 0; s <= 4; s++) {
      pts.push(`${(cx + r * Math.sin(at(s))).toFixed(2)},${(y - ry * Math.cos(at(s))).toFixed(2)}`)
    }
    for (let s = 4; s >= 0; s--) {
      pts.push(`${(cx + r * Math.sin(at(s))).toFixed(2)},${(y + hs - ry * Math.cos(at(s))).toFixed(2)}`)
    }
    inserts.push(pts.join(' '))
  }

  // Outlined down the sides and along the bottom only: a line across the top
  // would draw a second rim under the face and read as another chip. Under a
  // chip that sits on top, the bevel catching the light marks the join instead.
  const outline = `M ${cx - r} ${y} L ${cx - r} ${y + hs} A ${r} ${ry} 0 0 0 ${cx + r} ${y + hs} L ${cx + r} ${y}`
  const rim = `M ${cx - r} ${y + 0.45} A ${r} ${ry} 0 0 0 ${cx + r} ${y + 0.45}`

  return (
    <g className={fresh ? 'chip-drop' : undefined} style={fresh ? { animationDelay: `${delay}ms` } : undefined}>
      <path d={band} fill={chip.denom.body} />
      {inserts.map((points, i) => (
        <polygon key={i} points={points} fill={chip.denom.insert} opacity="0.92" />
      ))}
      <path d={band} fill="url(#chip-side)" />
      <path d={outline} fill="none" stroke="#000" strokeOpacity="0.4" strokeWidth="0.55" />
      {!top && <path d={rim} fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="0.6" />}
    </g>
  )
}

/** A chip's face, squashed to the felt's angle, lying on top of its band. */
function ChipTop({ chip, x, y, r, ry, fresh, delay }: { chip: ChipDraw; x: number; y: number; r: number; ry: number; fresh: boolean; delay: number }) {
  return (
    <g className={fresh ? 'chip-drop' : undefined} style={fresh ? { animationDelay: `${delay}ms` } : undefined}>
      <g transform={`translate(${x} ${y}) scale(${r / 50} ${ry / 50})`}>
        <ChipFace denom={chip.denom} rotate={chip.rot} labelRotate={chip.label} outlined={false} />
      </g>
    </g>
  )
}

export const ChipStack = memo(function ChipStack({
  amount,
  chips: given,
  size = 58,
  tilt = 32,
  seed = 1,
  perColumn = 12,
  className,
  style,
  billboard = true,
  dropIn = false,
}: Props) {
  const chips = useMemo(() => given ?? chipBreakdown(amount ?? 0), [given, amount])

  const draws = useMemo<ChipDraw[]>(
    () =>
      chips.map((denom, i) => ({
        denom,
        rot: hash(seed * 31 + i * 7.13) * 360,
        label: (hash(seed * 5 + i * 2.31) - 0.5) * 50,
        slop: (hash(seed * 17 + i * 3.07) - 0.5) * 0.035,
      })),
    [chips, seed],
  )

  // Chips beyond the count we last drew drop in from above.
  const previous = useRef(dropIn ? 0 : chips.length)
  const freshFrom = previous.current
  useEffect(() => {
    previous.current = chips.length
  }, [chips.length])

  if (chips.length === 0) return null

  const cols = columnsOf(draws, perColumn)
  const steps = cols.map((column) => stepsOf(column, size))
  // A column that steps aside pushes the next one along by as much.
  const along = steps.map((_, c) => steps.slice(0, c).reduce((sum, s) => sum + s.at(-1)!, 0))
  const reach = along.at(-1)! + steps.at(-1)!.at(-1)!
  const tallest = Math.max(...cols.map((c) => c.length))
  const geo = stackGeometry(tallest, size, tilt, cols.length, reach)
  const t = (tilt * Math.PI) / 180
  const r = size / 2
  const ry = r * Math.cos(t)
  const hs = size * THICKNESS * Math.sin(t)
  const gap = size * 0.08

  let index = 0
  const content = cols.map((column, c) => {
    const cx = 1 + r + c * (size + gap) + along[c]
    // A chip that a smaller one sits on shows its face where the smaller one
    // has stepped aside, its value squared up to read; the topmost chip always
    // shows its face.
    const faces: { chip: ChipDraw; x: number; y: number; n: number }[] = []
    const parts = column.map((chip, i) => {
      const x = cx + steps[c][i] + chip.slop * size
      const y = geo.baseY - (i + 1) * hs
      const n = index++
      const fresh = n >= freshFrom
      const stepsNext = i < column.length - 1 && steps[c][i + 1] !== steps[c][i]
      const face = i === column.length - 1 || stepsNext
      if (face) faces.push({ chip, x, y, n })
      return (
        <g key={i}>
          <Band cx={x} y={y} r={r} ry={ry} hs={hs} chip={chip} top={face} fresh={fresh} delay={(n - freshFrom) * 45} />
          {stepsNext && <ChipTop chip={{ ...chip, label: 0 }} x={x} y={y} r={r} ry={ry} fresh={fresh} delay={(n - freshFrom) * 45} />}
        </g>
      )
    })
    const top = faces.at(-1)!
    return (
      <g key={c}>
        {parts}
        <ChipTop chip={top.chip} x={top.x} y={top.y} r={r} ry={ry} fresh={top.n >= freshFrom} delay={(top.n - freshFrom) * 45} />
      </g>
    )
  })

  // Stood up from its front edge: pivoting about the centre of the bottom
  // chip would swing the near half of that chip down through the felt. The
  // front edge of a chip is one radius nearer the viewer than its centre, so
  // the pivot moves forward by that much and the footprint lands on the spot.
  const wrapStyle: CSSProperties = billboard
    ? {
        position: 'absolute',
        left: -geo.baseX,
        top: -geo.height + r,
        width: geo.width,
        height: geo.height,
        transformOrigin: `${geo.baseX}px ${geo.height}px`,
        transform: `rotateX(${-tilt}deg)`,
        ...style,
      }
    : {
        position: 'absolute',
        left: -geo.baseX,
        top: -geo.baseY,
        width: geo.width,
        height: geo.height,
        ...style,
      }

  return (
    <svg
      className={`chip-stack${className ? ` ${className}` : ''}`}
      style={wrapStyle}
      width={geo.width}
      height={geo.height}
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      aria-hidden="true"
      overflow="visible"
    >
      {content}
    </svg>
  )
})

/**
 * A single chip for the player's rack: seen a little from above, so it shows
 * its edge and sits in the rack as a solid thing rather than a printed disc.
 * Squared up, with the denomination upright for reading at a glance.
 */
export function RackChip({ denom, size = 56, tilt = 26 }: { denom: Denomination; size?: number; tilt?: number }) {
  const t = (tilt * Math.PI) / 180
  const r = size / 2
  const ry = r * Math.cos(t)
  const hs = size * THICKNESS * Math.sin(t)
  const width = size + 2
  const height = 2 * ry + hs + 2
  const cx = width / 2
  const y = 1 + ry
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <Band cx={cx} y={y} r={r} ry={ry} hs={hs} chip={{ denom, rot: 0, label: 0, slop: 0 }} top fresh={false} delay={0} />
      <g transform={`translate(${cx} ${y}) scale(${r / 50} ${ry / 50})`}>
        <ChipFace denom={denom} outlined={false} />
      </g>
    </svg>
  )
}
